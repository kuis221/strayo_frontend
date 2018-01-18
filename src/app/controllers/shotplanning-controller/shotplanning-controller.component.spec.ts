import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ShotplanningControllerComponent } from './shotplanning-controller.component';

describe('ShotplanningControllerComponent', () => {
  let component: ShotplanningControllerComponent;
  let fixture: ComponentFixture<ShotplanningControllerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ShotplanningControllerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ShotplanningControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
