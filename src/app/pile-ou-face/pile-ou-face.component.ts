import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';

interface Game {
  _id: string;
  player: string;
  playerPseudo: string;
  choice: string;
  amount: number;
  status: string;
  opponent?: string;
  opponentPseudo?: string;
  result?: string;
  winner?: string;
}

@Component({
  selector: 'app-pile-ou-face',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './pile-ou-face.component.html',
  styleUrls: ['./pile-ou-face.component.scss']
})
export class PileOuFaceComponent implements OnInit, OnDestroy {
  games: Game[] = [];
  newGame = { choice: 'pile', amount: 0 };
  errorMsg = '';

  wallet: string | null = null;
  pseudo: string | null = null;

  waitingModal = false;
  showResultModal = false;
  showTimerModal = false;
  countdown = 3;
  private refreshGamesInterval: any;

  createdGame: Game | null = null;
  lastGameResult: Game | null = null;

  private pollingInterval: any;
  private countdownInterval: any;

  constructor(private http: HttpClient, private userService: UserService) {}

  ngOnInit() {
    this.userService.wallet$.subscribe(w => this.wallet = w);
    this.userService.pseudo$.subscribe(p => this.pseudo = p);
    this.loadGames();

    this.refreshGamesInterval = setInterval(() => {
    this.loadGames();
  }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.pollingInterval);
    clearInterval(this.countdownInterval);
    clearInterval(this.refreshGamesInterval);
    
  }

  loadGames() {
    this.http.get<Game[]>('http://localhost:3000/games').subscribe({
      next: data => this.games = data.filter(g => g.status === 'waiting'),
      error: () => this.errorMsg = 'Erreur chargement des parties'
    });
  }

  createGame() {
    if (!this.wallet || !this.pseudo) {
      this.errorMsg = 'Wallet et pseudo requis';
      return;
    }
    if (this.newGame.amount <= 0) {
      this.errorMsg = 'Montant invalide';
      return;
    }

    this.http.post<Game>('http://localhost:3000/games', {
      player: this.wallet,
      choice: this.newGame.choice,
      amount: this.newGame.amount
    }).subscribe({
      next: (game) => {
        this.createdGame = game;
        this.waitingModal = true;
        this.pollGameStatus(game._id);
        this.loadGames();
        this.newGame.amount = 0;
        this.errorMsg = '';
      },
      error: () => this.errorMsg = 'Erreur création partie'
    });
  }

  joinGame(gameId: string) {
    if (!this.wallet || !this.pseudo) {
      this.errorMsg = 'Wallet et pseudo requis';
      return;
    }

    this.http.post<Game>(`http://localhost:3000/games/${gameId}/join`, {
      player: this.wallet
    }).subscribe({
      next: (game) => {
        this.lastGameResult = game;
        this.startCountdown(() => {
          this.showTimerModal = false;
          this.showResultModal = true;
        });
        this.loadGames();
      },
      error: () => this.errorMsg = 'Erreur rejoindre partie'
    });
  }

  pollGameStatus(gameId: string) {
    this.pollingInterval = setInterval(() => {
      this.http.get<Game>(`http://localhost:3000/games/${gameId}`).subscribe({
        next: (game) => {
          if (game.status === 'finished') {
            clearInterval(this.pollingInterval);
            this.waitingModal = false;
            this.lastGameResult = game;
            this.startCountdown(() => {
              this.showTimerModal = false;
              this.showResultModal = true;
            });
            this.createdGame = null;
            this.loadGames();
          }
        },
        error: () => console.error('Erreur polling')
      });
    }, 2000);
  }

  startCountdown(callback: () => void) {
    this.countdown = 3;
    this.showTimerModal = true;

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        clearInterval(this.countdownInterval);
        callback();
      }
    }, 1000);
  }

  closeModal() {
    this.showResultModal = false;
    this.lastGameResult = null;
  }
}
