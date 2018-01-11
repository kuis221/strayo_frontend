import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotationsLayersComponent } from './annotations-layers.component';

describe('AnnotationsLayersComponent', () => {
  let component: AnnotationsLayersComponent;
  let fixture: ComponentFixture<AnnotationsLayersComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AnnotationsLayersComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AnnotationsLayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
