import { Record, List } from 'immutable';
import { User } from '../models/user.model';

const userRecord = Record({
  users: List([]),
  currentUser: null,
  pending: false,
  error: null,
});

export class UsersState extends userRecord {
  users: List<User>;
  currentUser: User;
  pending: boolean;
  error: Error;

  public getUsers(): UsersState {
    return this.set('error', null).set('pending', true) as UsersState;
  }

  public getUsersError(error: Error): UsersState {
    return this.set('error', error).set('pending', false) as UsersState;
  }

  public getUsersSuccess(users: User[]): UsersState {
    return this.set('error', null).set('pending', true).set('users', List(users)) as UsersState;
  }

  public signIn(): UsersState {
    return this.set('error', null).set('pending', true) as UsersState;
  }

  public signInError(error: Error): UsersState {
    return this.set('error', error).set('pending', false) as UsersState;
  }

  public signInSuccess(users: User[]): UsersState {
    return this.set('error', null).set('pending', true).set('users', List(users)) as UsersState;
  }

  public signUp(): UsersState {
    return this.set('error', null).set('pending', true) as UsersState;
  }

  public signUpError(error: Error): UsersState {
    return this.set('error', error).set('pending', false) as UsersState;
  }

  public signUpSuccess(users: User[]): UsersState {
    return this.set('error', null).set('pending', true).set('users', List(users)) as UsersState;
  }

  public setCurrentUser(user: User): UsersState {
    return this.set('currentUser', user) as UsersState;
  }

  public setUsers(users: User[]): UsersState {
    return this.set('users', List(users)) as UsersState;
  }
}

export const getInitialState = () => new UsersState();
