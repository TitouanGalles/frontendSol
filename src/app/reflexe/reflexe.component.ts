import {
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  ViewChild,
  ElementRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SocketService } from '../services/socket.service';
import { SolanaService } from '../services/solana.service';
import { UserService } from '../services/user.service';
import { ReflexeService } from '../services/reflexe.service';
import { ReflexeGame } from '../models/game-reflexe.model';
import * as THREE from 'three';

@Component({
  selector: 'app-reflexe',
  templateUrl: './reflexe.component.html',
  styleUrls: ['./reflexe.component.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule],
})
export class ReflexGameComponent implements OnInit, OnDestroy {
  games: ReflexeGame[] = [];
  newGame = { amount: 0 };
  createdGame: ReflexeGame | null = null;
  wallet: string | null = null;
  pseudo: string | null = null;
  winner: string | undefined = '';
  gameModal: boolean = false;
  startTime: number | undefined;
  

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private ngZone: NgZone,
    private socketService: SocketService,
    private solanaService: SolanaService,
    private reflexService: ReflexeService
  ) {}
 

  ngOnInit(): void {
    this.reactionTime = null;
    this.winner = undefined;
    this.clicked = false;

    this.userService.wallet$.subscribe((w) => (this.wallet = w));
    this.userService.pseudo$.subscribe((p) => (this.pseudo = p));

    this.loadGames();

    this.socketService.listen<ReflexeGame>('timeUpdate').subscribe((updatedGame) => {
      console.log("Temps mis à jour : ", updatedGame);

      if (this.createdGame && updatedGame._id === this.createdGame._id) {
        this.createdGame = updatedGame;

        // Vérifie si les deux temps sont présents
        if (updatedGame.hostTime && updatedGame.opponentTime) {
          console.log('Les deux joueurs ont envoyé leur temps, calcul du gagnant...');
        }
      }
    });

    this.socketService.listen<any>('reflexResult').subscribe((data) => {
      if (this.createdGame && data.gameId === this.createdGame._id) {
        console.log('Résultat reçu:', data);

        // ✅ Mets à jour les temps de réaction dans l'objet createdGame
        this.createdGame.hostTime = data.hostTime;
        this.createdGame.opponentTime = data.opponentTime;

        // ✅ Puis calcule le gagnant
        this.calculWinner(data.hostTime, data.opponentTime);
      }
    });


    this.socketService.listen<ReflexeGame>('player-joined-reflex').subscribe((updatedGame) => {
      console.log("joueur rejoint : ", updatedGame);
      if (this.createdGame && updatedGame._id === this.createdGame._id) {
        this.createdGame = updatedGame;

        // Si les 2 joueurs sont là, démarrer la partie
        if (updatedGame.host?.pseudo && updatedGame.opponent?.pseudo) {
          console.log('Événement reçu : player-joined-reflex');
          //this.startLightsSequence();
          // this.startGameWithCountdown(); // à activer si besoin
        }
      }
    });

    this.socketService.emit('request-waiting-reflexGames');

    this.socketService.listen<ReflexeGame>('game-created-reflex').subscribe((game) => {
      if (game.status === 'waiting') {
        this.games.push(game);
      }
    });

    this.socketService.listen<ReflexeGame[]>('waiting-games').subscribe((games) => {
      this.games = games;
    });
  }

  ngOnDestroy(): void {
    // à compléter si besoin (ex: this.socketService.disconnect())
  }
 //debut feux

  @ViewChild('lightsCanvas') lightsCanvas!: ElementRef<HTMLCanvasElement>;

  private canvasInitialized = false;
  private ctx: CanvasRenderingContext2D | null = null;

  ngAfterViewChecked(): void {
    if (this.gameModal && this.lightsCanvas && !this.canvasInitialized) {
      this.initializeCanvas();
      this.canvasInitialized = true;
    }
  }

  initializeCanvas(): void {
  const canvas = this.lightsCanvas.nativeElement;

  // Redimensionnement
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  this.ctx = canvas.getContext('2d');
  if (!this.ctx) return;

  this.startF1LightsSequence(); // Appelle l'animation
}

startF1LightsSequence(): void {
  const canvas = this.lightsCanvas.nativeElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Dimensions
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  let currentLight = 0;
  const totalLights = 5;
  const radius = 30;
  const spacing = 20;
  const totalWidth = totalLights * radius * 2 + (totalLights - 1) * spacing;
  const startX = (canvas.width - totalWidth) / 2;
  const centerY = canvas.height / 2;

  const drawLights = (active: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < totalLights; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * (radius * 2 + spacing) + radius, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = i <= active ? 'red' : '#222';
      ctx.fill();
    }
  };

  const interval = setInterval(() => {
    drawLights(currentLight);
    currentLight++;
    if (currentLight >= totalLights) {
      clearInterval(interval);

      // Délai aléatoire entre 500 et 2000 ms avant extinction
      const randomDelay = 500 + Math.random() * 1500;
      setTimeout(() => {
        drawLights(-1); // Tous éteints
        // Appelle ici la logique de départ du jeu (start timer etc)
        this.canClick = true;
        this.reactionStartTime = performance.now();
      }, randomDelay);
    }
  }, 1000); // 1 feu rouge toutes les secondes
}




  //fin feux
  loadGames() {
    this.reflexService.getGames().subscribe((games) => {
      this.games = games;
    });
  }

  createGame() {
    if (!this.wallet || !this.pseudo) {
      console.log('Connecte-toi avant de créer une partie');
      return;
    }
    if (!this.newGame.amount || this.newGame.amount <= 0) {
      console.log('Montant invalide');
      return;
    }
    console.log(this.pseudo, this.wallet);
    const newGamePayload: Partial<ReflexeGame> = {
      host: {
        pseudo: this.pseudo,
        wallet: this.wallet,
      },
      amount: this.newGame.amount,
      status: 'waiting',
      lock: false,
    };
  
    this.reflexService.createGame(newGamePayload).subscribe({
      next: (game) => {
        console.log('Partie créée', game);
        this.createdGame = game;
        this.showGameModal();
        // Supprimer la ligne suivante pour éviter doublons, car socket.io gère ça
        // this.games.push(game);
        this.newGame.amount = 0;
        this.socketService.joinGameRoom(this.createdGame._id);
      },
      error: (err) => {
        console.error('Erreur création partie:', err);
      },
    });
  }
  
  

  joinReflexGame(gameId: string) {
    if (!this.pseudo || !this.wallet) {
      console.log('Pseudo ou wallet manquant');
      return;
    }

    this.reflexService.joinGame(gameId, {
      pseudo: this.pseudo,
      wallet: this.wallet,
    }).subscribe({
      next: (game: ReflexeGame) => {
        console.log('Partie rejointe avec succès', game);
        this.createdGame = game;
        this.showGameModal();
        this.socketService.emit('player-joined-reflex', game._id!);
        this.socketService.joinGameRoom(this.createdGame._id);

        // this.status = 'en cours';
      },
      error: (err) => {
        console.error('Erreur lors de la jointure :', err);
        alert(err.error?.error || 'Impossible de rejoindre la partie.');
      },
    });
    //this.startLightsSequence();
  }

  lightStep = 0;
  canClick = false;
  clicked = false;
  reactionStartTime!: number;
  reactionTime!: number | null;
  waitingOpponent = true;
  bothPlayersPresent = false;
/** 
  startLightsSequence() {
    let steps = [1, 2, 3, 4];
    let delay = 1000;
    this.lightStep = 0;
    this.canClick = false;
    this.clicked = false;

    let i = 0;
    const interval = setInterval(() => {
      this.lightStep = steps[i];
      i++;
      if (i >= steps.length) {
        clearInterval(interval);
        // Random delay before green
        const randomDelay = 1000 + Math.random() * 3000;
        setTimeout(() => {
          this.lightStep = 5;
          this.reactionStartTime = performance.now();
          this.canClick = true;
        }, randomDelay);
      }
    }, delay);
  }
**/
handleClick() {
  const now = performance.now();

  // Empêche double clic
  if (this.clicked) return;

  this.clicked = true;

  if (!this.canClick) {
    // ❌ Trop tôt → défaite
    this.reactionTime = 0;
    this.socketService.emit('reflex-clicked', { tooSoon: true });
  } else {
    // ✅ Bon timing → enregistre le temps de réaction
    this.reactionTime = now - this.reactionStartTime;

    // Émission Socket.IO
    this.socketService.emit('reflex-clicked', {
      tooSoon: false,
      time: this.reactionTime
    });

    // ✅ Vérifie que les valeurs nécessaires sont bien présentes
    if (this.createdGame && this.wallet) {
      this.reflexService.sendReactionTime(
        this.createdGame._id,
        this.wallet,
        this.reactionTime
      ).subscribe({
        next: (res) => console.log('Temps enregistré :', res),
        error: (err) => console.error('Erreur envoi du temps', err),
      });
    } else {
      console.warn('Impossible d\'envoyer le temps : partie ou wallet manquant.');
    }
  }
}



calculWinner(hostTimeStr: string, opponentTimeStr: string) {
  const hostTime = parseFloat(hostTimeStr);
  const opponentTime = parseFloat(opponentTimeStr);

  if (isNaN(hostTime) || isNaN(opponentTime)) {
    console.warn('Temps invalides');
    return;
  }

  if (hostTime < opponentTime) {
    this.winner = this.createdGame?.host.pseudo!;
  } else if (opponentTime < hostTime) {
    this.winner = this.createdGame?.opponent?.pseudo!;
  } else {
    this.winner = 'Égalité';
  }

  console.log('Gagnant:', this.winner);

  // Appel du backend pour terminer la partie
  const gameId = this.createdGame?._id;

  if (gameId && this.winner && this.winner !== 'Égalité') {
    this.reflexService.finishGame(gameId, this.winner).subscribe({
      next: (updatedGame) => {
        console.log('Partie mise à jour :', updatedGame);
        this.createdGame = updatedGame;
        // Affiche modale, notif, etc.
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour de la partie :', error);
      }
    });
  } else if (this.winner === 'Égalité') {
    console.log('Aucun gagnant à enregistrer (égalité)');
    // Tu peux gérer ce cas si tu veux aussi l’enregistrer
  }
}


closeGameModal() {
  this.gameModal = false;
  this.createdGame = null;
  console.log(this.createdGame);
  this.reactionTime = null;
  this.winner = undefined;
  this.clicked = false;
}

showGameModal() {
  this.gameModal = true;
  this.canvasInitialized = false;
}

}
