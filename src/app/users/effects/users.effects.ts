import { Injectable } from '@angular/core';
import { Actions, Effect } from '@ngrx/effects';

import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/map';

import { UsersActionsType, GetUsersSuccess, GetUsers, SignIn, SignInSuccess, SignUp, SignUpSuccess } from '../actions/actions';
import { UsersService } from '../users.service';

@Injectable()
export class UsersEffects {
  constructor (private actions$: Actions, private usersService: UsersService) {}

  @Effect() getUsers$ = this.actions$.ofType(UsersActionsType.GET_USERS)
    .map((action: GetUsers) => action.payload)
    .mergeMap(action => this.usersService.getUsers().map(users => new GetUsersSuccess(users)));

  @Effect() signIn$ = this.actions$.ofType(UsersActionsType.SIGN_IN)
    .map((action: SignIn) => action.payload)
    .mergeMap(action => this.usersService.signIn(action).map(users => new SignInSuccess(users)));

  @Effect() signUp$ = this.actions$.ofType(UsersActionsType.SIGN_UP)
    .map((action: SignUp) => action.payload)
    .mergeMap(action => this.usersService.signUp(action).map(users => new SignUpSuccess(users)));
}
