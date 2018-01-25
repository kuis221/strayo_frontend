import { Component, OnInit } from '@angular/core';
import { debounce } from 'lodash';
import { switchMap, map, tap, debounceTime } from 'rxjs/operators';
import { List } from 'immutable';
import { DatasetsService } from '../../datasets/datasets.service';
import { Dataset } from '../../models/dataset.model';
import { Observable } from 'rxjs/Observable';
import { DomSanitizer } from '@angular/platform-browser';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';

type Timeline = KeyFrame[];

interface KeyFrame {
  index?: number;
  dataset: Dataset;
  isSelected: boolean;
  isMain: boolean;
  color;
}

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.css']
})
export class TimelineComponent implements OnInit {
  timeline$: Observable<Timeline>;
  timeline: Timeline = [];
  constructor(private datasetsService: DatasetsService, private sanitizer: DomSanitizer) { }

  ngOnInit() {
    this.initTimeline();
    this.timeline$.subscribe((timeline) => {
      this.timeline = timeline;
    });
    // Wait a second so that the page can load
    this.datasetsService.mainDataset.pipe(debounceTime(1000)).subscribe((mainDataset) => {
      const mainKeyframe = this.timeline.find((d) => d.isMain);
      if (mainKeyframe) {
        const left = $('.myTimelineCont').scrollLeft() + $(`#keyframe-${mainKeyframe.dataset.id()}`).offset().left;
        console.log('found main keyframe', $('.myTimelineCont').scrollLeft(), $(`#keyframe-${mainKeyframe.dataset.id()}`).offset());
        // I'ts a hack. Deal with it. 2 * margin + width = 195;
        $('.myTimelineCont').scrollLeft(195 * mainKeyframe.index);
      }
    });
  }

  public selectKeyframe(keyframe: KeyFrame, deselect?: boolean) {
    if (keyframe.isMain) return;
    console.log('keyframe selected', keyframe);
    if (!keyframe.isSelected && !deselect) {
      this.datasetsService.addToSelected(keyframe.dataset);
    } else {
      this.datasetsService.removeFromSelected(keyframe.dataset);
    }
  }

  private initTimeline() {
    this.timeline$ = this.datasetsService.mainDataset.pipe(
      switchMap((mainDataset) => {
        return this.datasetsService.datasets.pipe(
          switchMap((datasets) => {
            return this.datasetsService.selectedDatasets.pipe(
              map((selectedDatasets) => {
                return datasets.map((dataset, i) => {
                  return {
                    dataset,
                    isSelected: selectedDatasets.some(d => d.id() === dataset.id()),
                    isMain: mainDataset && (mainDataset.id() === dataset.id()),
                    color: this.sanitizer.bypassSecurityTrustStyle(`border: 5px solid ${dataset.color()}`),
                  };
                })
                  .toArray()
                  .filter(k => !k.dataset.isPhantom())
                  .sort((a, b) => ((a.dataset.createdAt() as any) - (b.dataset.createdAt() as any)))
                  .map((k, i) => {
                    (k as any).index = i;
                    return k;
                  });
              }),
            );
          })
        );
      })
    );
  }

}
