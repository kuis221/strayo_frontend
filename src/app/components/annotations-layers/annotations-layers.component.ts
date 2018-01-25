import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';


@Component({
  selector: 'app-annotations-layers',
  templateUrl: './annotations-layers.component.html',
  styleUrls: ['./annotations-layers.component.css']
})
export class AnnotationsLayersComponent implements OnInit {
  @ViewChild('staticTabs') staticTabs: ElementRef;
  showLayers = false;
  constructor() { }

  ngOnInit() {
    this.onTabSwitch(false);
  }

  onTabSwitch(showLayers) {
    this.showLayers = showLayers;
    setTimeout(() => {
      $('.tabContent').slideDown();
    }, 200);
  }

}
