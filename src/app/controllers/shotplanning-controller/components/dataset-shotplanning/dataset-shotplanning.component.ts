import { Component, OnInit, Input } from '@angular/core';

import { Shotplan } from '../../../../models/shotplan.model';
import { Dataset } from '../../../../models/dataset.model';
@Component({
  selector: 'app-dataset-shotplanning',
  templateUrl: './dataset-shotplanning.component.html',
  styleUrls: ['./dataset-shotplanning.component.css']
})
export class DatasetShotplanningComponent implements OnInit {
  @Input() dataset: Dataset;

  shotplan: Shotplan;

  annotationOff: Function;
  constructor() { }

  ngOnInit() {
  }

}
