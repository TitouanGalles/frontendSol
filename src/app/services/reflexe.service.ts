import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReflexeGame } from '../models/game-reflexe.model';

@Injectable({
  providedIn: 'root'
})
export class ReflexeService {
  private apiUrl = 'http://localhost:3000/api/reflex'; // adapte selon ton backend

  constructor(private http: HttpClient) {}

  getGames(): Observable<ReflexeGame[]> {
    return this.http.get<ReflexeGame[]>(`${this.apiUrl}/games`);
  }

  createGame(game: Partial<ReflexeGame>): Observable<ReflexeGame> {
    console.log("creation : ", game);
    return this.http.post<ReflexeGame>(`${this.apiUrl}/create`, game);
  }

  joinGame(gameId: string, opponent: {pseudo: string, wallet: string}): Observable<ReflexeGame> {
    console.log(opponent);
    return this.http.post<ReflexeGame>(`${this.apiUrl}/join/${gameId}`, opponent);
  }

  lockGame(gameId: string): Observable<ReflexeGame> {
    return this.http.put<ReflexeGame>(`${this.apiUrl}/lock/${gameId}`, {});
  }

  unlockGame(gameId: string): Observable<ReflexeGame> {
    return this.http.put<ReflexeGame>(`${this.apiUrl}/unlock/${gameId}`, {});
  }

  sendReactionTime(gameId: string, wallet: string, time: number): Observable<any> {
  return this.http.post(`${this.apiUrl}/time/${gameId}`, {
    wallet,
    time
  });
  }

  finishGame(gameId: string, winner: string): Observable<ReflexeGame> {
    return this.http.post<ReflexeGame>(`${this.apiUrl}/end/${gameId}`, { winner });
  }


}
