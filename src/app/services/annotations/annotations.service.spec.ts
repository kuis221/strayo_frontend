import { TestBed, inject } from '@angular/core/testing';

import { AnnotationsService } from './annotations.service';

describe('AnnotationsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnnotationsService]
    });
  });

  it('should be created', inject([AnnotationsService], (service: AnnotationsService) => {
    expect(service).toBeTruthy();
  }));
});
