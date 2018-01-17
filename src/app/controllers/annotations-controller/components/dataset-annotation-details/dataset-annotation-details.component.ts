import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import Chart from 'chart.js';
import * as ol from 'openlayers';
import * as d3 from 'd3';
import { Dataset } from '../../../../models/dataset.model';
import { Annotation } from '../../../../models/annotation.model';
import { IAnnotationToolMeta } from '../../../../models/annotationToolMeta';
import { listenOn } from '../../../../util/listenOn';
import { TerrainProvider } from '../../../../models/terrainProvider.model';
import { sampleHeightsAlong } from '../../../../util/osgjsUtil/index';
import { AnnotationToolType } from '../../../../models/annotationToolType';

@Component({
  selector: 'app-dataset-annotation-details',
  templateUrl: './dataset-annotation-details.component.html',
  styleUrls: ['./dataset-annotation-details.component.css']
})
export class DatasetAnnotationDetailsComponent implements OnInit, OnDestroy {
  @Input() dataset: Dataset;
  @Input() annotation: Annotation;
  @Input() provider: TerrainProvider;

  @ViewChild('heightGraphCont', { read: ElementRef }) heightGraphCont: ElementRef;
  @ViewChild('heightGraph', { read: ElementRef }) heightGraph: ElementRef;
  name: string;
  tool: AnnotationToolType;
  horizontalLength: string;
  sphericalLength: string;

  metaUnsubscribe: Function;
  recalculateUnsubscribe: Function;

  showHeightGraph: boolean;
  samples: osg.Vec3[];
  heightGraphChart: any;

  constructor(private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.name = (this.annotation.meta() as IAnnotationToolMeta).name;
    this.tool = (this.annotation.meta() as IAnnotationToolMeta).tool;
    
    this.recalculate();

    this.metaUnsubscribe = listenOn(this.annotation, 'change:meta', () => {
      this.name = (this.annotation.meta() as IAnnotationToolMeta).name;
    });

    this.recalculateUnsubscribe = listenOn(this.getGeometry(), 'change', () => {
      this.recalculate();
    });
    this.cd.markForCheck();
  }

  createHeightGraph() {
    if (!this.samples) {
      this.samplePoints();
    }
    const extent = d3.extent(this.samples, (s) => s[1]);
    const ctx = this.heightGraph.nativeElement.getContext('2d');
    const data = this.samples.map((s) => s[1]);
    const labels = this.samples.map((s, i) => i);
    // console.log('data', data, extent);
    this.heightGraphChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: 'aquamarine',
          fill: false,
          lineTension: 0,
        }]
      },
      options: {
        title: {
          display: true,
          text: 'Height (in m)',
        },
        legend: {
          display: false,
        },
        responsive: true,
        scales: {
          yAxes: [{
            display: true,
            scaleLabel: {
              display: true,
            },
            ticks: {
              min: extent[0],
              max: extent[1],
            }
          }]
        }
      }
    });
  }

  getGeometry() {
    const feature = this.annotation.data().item(0);
    const geometry = feature.getGeometry() as ol.geom.LineString;
    return geometry;
  }

  getPlanarLength(): number {
    const geometry = this.getGeometry();
    return geometry.getLength();
  }

  getSphericalLength(): number {
    const geometry = this.getGeometry();
    return ol.Sphere.getLength(geometry);
  }

  formatLength(length: number) {
    if (length > 100) {
      return `${Number(length / 1000).toFixed(2)} km`;
    }
    return `${Number(length).toFixed(2)} m`;
  }

  samplePoints() {
    const geometry = this.getGeometry();
    const samples = sampleHeightsAlong(geometry.getCoordinates(), 1, this.provider.getWorldPoint.bind(this.provider));
    samples.forEach((point) => {
      point[1] = Math.abs(point[1]);
    });
    this.samples = samples;
    return samples;
  }

  toggleHeightGraph(show: boolean) {
    if (!this.heightGraphCont) return;
    if (show) {
      if (!this.heightGraphChart) this.createHeightGraph();
      $(this.heightGraphCont.nativeElement).slideDown(300);
    } else {
      $(this.heightGraphCont.nativeElement).slideUp(300);
    }
  }

  recalculate() {
    console.log('tool', this.tool);
    switch (this.tool) {
      case 'Polygon':
        break;
      default:
      this.horizontalLength = this.formatLength(this.getPlanarLength());
      this.sphericalLength = this.formatLength(this.getSphericalLength());
    }
    this.samples = null;
    this.toggleHeightGraph(false);
    this.cd.markForCheck();
  }

  ngOnDestroy() {
    this.metaUnsubscribe();
    this.recalculateUnsubscribe();
  }

}
