import { Component, OnInit } from '@angular/core';
import { List } from 'immutable';
import { Observable } from 'rxjs/Observable';
import { DatasetsService } from '../../datasets/datasets.service';
import { Dataset } from '../../models/dataset.model';

@Component({
  selector: 'app-shotplanning-controller',
  templateUrl: './shotplanning-controller.component.html',
  styleUrls: ['./shotplanning-controller.component.css']
})
export class ShotplanningControllerComponent implements OnInit {
  datasets$: Observable<List<Dataset>>;
  mainDataset$: Observable<Dataset>;
  constructor(private datasetsService: DatasetsService) { }

  ngOnInit() {
    this.mainDataset$ = this.datasetsService.mainDataset;
    this.datasets$ = this.datasetsService.selectedDatasets;
  }

}
