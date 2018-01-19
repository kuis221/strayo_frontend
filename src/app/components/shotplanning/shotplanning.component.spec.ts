import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ShotplanningComponent } from './shotplanning.component';

describe('ShotplanningComponent', () => {
  let component: ShotplanningComponent;
  let fixture: ComponentFixture<ShotplanningComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ShotplanningComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ShotplanningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
