import { TestBed, inject } from '@angular/core/testing';

import { AnnotationsSaverService } from './annotations-saver.service';

describe('AnnotationsSaverService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnnotationsSaverService]
    });
  });

  it('should be created', inject([AnnotationsSaverService], (service: AnnotationsSaverService) => {
    expect(service).toBeTruthy();
  }));
});
