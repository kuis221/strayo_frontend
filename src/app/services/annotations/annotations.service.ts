import { Injectable } from '@angular/core';

import { DatasetsService } from '../../datasets/datasets.service';

class AnnotationListener {
  static ANNOTATION_TYPE = '';
}

@Injectable()
export class AnnotationsService {

  constructor(private datasetsService: DatasetsService) {

  }
}
