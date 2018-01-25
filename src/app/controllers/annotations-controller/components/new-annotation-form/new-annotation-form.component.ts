import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';

import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { Observable } from 'rxjs/Observable';
import { List } from 'immutable';
import { debounceTime } from 'rxjs/operators';
import { FormGroup, FormBuilder, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { DatasetsService } from '../../../../datasets/datasets.service';
import { Dataset } from '../../../../models/dataset.model';
import { subscribeOn } from '../../../../util/subscribeOn';

interface NewAnnotationForm {
  name: string;
  notes: string;
  dataset: string;
}

@Component({
  selector: 'app-new-annotation-form',
  templateUrl: './new-annotation-form.component.html',
  styleUrls: ['./new-annotation-form.component.css']
})
export class NewAnnotationFormComponent implements OnInit, OnDestroy {
  public newAnnotationForm: FormGroup;

  datasets$: Observable<List<Dataset>>;
  off: Function[] = [];
  @Output() submit: EventEmitter<any> = new EventEmitter();
  constructor(public datasetsService: DatasetsService, public fb: FormBuilder, public bsModalRef: BsModalRef) { }

  ngOnInit() {
    this.datasets$ = this.datasetsService.selectedDatasets;
    this.createForm();
  }

  createForm() {
    this.newAnnotationForm = this.fb.group({
      name: ['', Validators.required],
      dataset: ['', Validators.required],
      notes: ['']
    });
  }

  onSelect(dataset) {
    console.log('SelectPicker changed', dataset);
  }

  onSubmit() {
    const value = this.newAnnotationForm.value;
    this.submit.emit({name: value.name, dataset: +value.dataset, notes: value.notes});
    this.bsModalRef.hide();
  }

  ngOnDestroy() {
    this.off.forEach(off => off());
  }
}
