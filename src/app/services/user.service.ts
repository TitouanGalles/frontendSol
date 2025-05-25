import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userPseudo: string | null = null;
  private walletSubject = new BehaviorSubject<string | null>(null);
  wallet$: Observable<string | null> = this.walletSubject.asObservable();

  private pseudoSubject = new BehaviorSubject<string | null>(null);
  pseudo$: Observable<string | null> = this.pseudoSubject.asObservable();

  setUser(wallet: string | null, pseudo: string | null) {
    console.log("set user", wallet, pseudo);
    this.walletSubject.next(wallet);
    this.pseudoSubject.next(pseudo);
    this.userPseudo = pseudo;
  }

  clearUser() {
    this.walletSubject.next(null);
    this.pseudoSubject.next(null);
  }

  getUserPseudo(){
    return this.userPseudo;
  }
  
}