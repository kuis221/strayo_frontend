import { TestBed, inject } from '@angular/core/testing';

import { ShotplansService } from './shotplans.service';

describe('ShotplansService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShotplansService]
    });
  });

  it('should be created', inject([ShotplansService], (service: ShotplansService) => {
    expect(service).toBeTruthy();
  }));
});
