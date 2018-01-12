import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef } from '@angular/core';
import { Dataset } from '../../../../models/dataset.model';
import { listenOn } from '../../../../util/listenOn';
import { Annotation } from '../../../../models/annotation.model';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

@Component({
  selector: 'app-dataset-annotations',
  templateUrl: './dataset-annotations.component.html',
  styleUrls: ['./dataset-annotations.component.css']
})
export class DatasetAnnotationsComponent implements OnInit, OnDestroy {
  @Input() dataset: Dataset;
  private annotationsSource = new BehaviorSubject<Annotation[]>([]);
  annotations$ = this.annotationsSource.asObservable();
  off: Function;
  @ViewChild('annotationList', { read: ElementRef }) annotationList: ElementRef;
  constructor() { }

  ngOnInit() {
    this.off = listenOn(this.dataset, 'change:annotations', () => {
      this.annotationsSource.next(this.dataset.annotations().filter(a => a.type() === 'annotation'));
    });
  }

  ngOnDestroy() {
    if (this.off) this.off();
  }

  toggle(show) {
    if (show) {
      $(this.annotationList.nativeElement).slideDown(300);
    } else {
      $(this.annotationList.nativeElement).slideUp(300);
    }
  }
}
