import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { map, take } from 'rxjs/operators';

import * as Users from './actions/actions';
import * as fromAuth from './reducers/reducer';
import { UsersState } from './state';
import { UsersService } from './users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private userService: UsersService) {}

  async canActivate(): Promise<boolean> {
    const currentUser = this.userService.currentUserSource.getValue();
    if (currentUser) return true;
    const email = localStorage.getItem('email') || null;
    const token = localStorage.getItem('token') || null;
    if (!(email && token)) return false;
    const user = await this.userService.loginFromToken(email, token);
    if (user) {
      return true;
    } else {
      localStorage.setItem('email', null);
      localStorage.setItem('token', null);
      this.userService.redirectToLogin();
      return false;
    }
  }
}
