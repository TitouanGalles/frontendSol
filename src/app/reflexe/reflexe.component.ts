import {
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  ViewChild,
  ElementRef,
  AfterViewInit
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
export class ReflexGameComponent implements OnInit, OnDestroy, AfterViewInit {
  games: ReflexeGame[] = [];
  newGame = { amount: 0 };
  createdGame: ReflexeGame | null = null;
  wallet: string | null = null;
  pseudo: string | null = null;
  winner: string | undefined = '';
  gameModal: boolean = false;
  startTime: number | undefined;
  gameStart = false;
  
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  plane!: THREE.Mesh;
  material!: THREE.MeshBasicMaterial;
  container!: HTMLElement;

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private ngZone: NgZone,
    private socketService: SocketService,
    private solanaService: SolanaService,
    private reflexService: ReflexeService
  ) {}
  ngAfterViewInit(): void {
  }
  
 

  ngOnInit(): void {
    this.gameStart = false;
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
          this.startLightsSequence();
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

    this.socketService.listen<ReflexeGame>('game-updated-reflex').subscribe((updatedGame) => {
      console.log("GameUpdate");
      const index = this.games.findIndex(g => g._id === updatedGame._id);
    
      if (updatedGame.status === 'waiting' && !updatedGame.lock) {
        if (index > -1) {
          this.games[index] = updatedGame;
        } else {
          this.games.push(updatedGame);
        }
      } else {
        // Retire la partie si elle n’est plus disponible
        if (index > -1) {
          this.games.splice(index, 1);
        }
      }
    });
  }

  ngOnDestroy(): void {
    // à compléter si besoin (ex: this.socketService.disconnect())
  }
 //debut feux
 image = false;


 initScene(): void {
  this.container = document.getElementById('three-container-img')!;
  if (!this.container) {
    console.error('Conteneur non trouvé');
    return;
  }

  // Initialisation de la scène
  this.scene = new THREE.Scene();

  // Caméra
  this.camera = new THREE.PerspectiveCamera(
    70,
    this.container.clientWidth / this.container.clientHeight,
    0.1,
    1000
  );
  this.camera.position.z = 5;

  // Rendu
  this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  this.renderer.outputColorSpace = THREE.SRGBColorSpace; // ✅ corrige le rendu des couleurs
  this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  this.container.appendChild(this.renderer.domElement);

  // Matériau de base
  this.material = new THREE.MeshBasicMaterial({ transparent: true });

  // Dimensions du plan (proportionnel au conteneur)
  const width = this.container.clientWidth;
  const height = this.container.clientHeight;
  const planeHeight = 6;
  const aspect = width / height;
  const planeWidth = planeHeight * aspect;

  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  this.plane = new THREE.Mesh(geometry, this.material);
  this.scene.add(this.plane);

  // Affiche la première image par défaut
  this.changeImage('1.png');
}

changeImage(filename: string) {
  const loader = new THREE.TextureLoader();
  loader.load(filename, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace; // ✅ garantit les vraies couleurs

    this.material.map = texture;
    this.material.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  });
}





 lightStep = 0; // 0 = aucun feu, 1 à 5 = feux rouges allumés, 6 = départ (feux éteints mais pas affichés)
 canClick = false;
 clicked = false;
 reactionStartTime!: number;
 reactionTime: number | null = null;
 
 currentLightImage = 'feux/0.png'; // par défaut rien
 
 startLightsSequence() {
   this.gameStart = true;
   setTimeout(() => {
    this.initScene();
  }, 1000);
   this.lightStep = 1;
   this.canClick = false;
   this.clicked = false;
   this.reactionTime = null;
 
   const delay = 1000; // 1s entre chaque feu rouge
 
   // Séquence 1 à 5 : on montre les feux rouges progressivement
   for (let i = 0; i <= 5; i++) {
    setTimeout(() => {
      this.lightStep = i;
      this.changeImage(`feux/${i}.png`); // Change l'image dans Three.js
    }, i * delay);
  }
 
   // 🔒 Anti-bot : on n'affiche pas l'image 6.png, mais on déclenche le départ
   const randomDelay = 1000 + Math.random() * 3000;
 
   setTimeout(() => {
     this.changeImage(`feux/${0}.png`); // état "départ" invisible
     this.canClick = true;
     this.reactionStartTime = performance.now();
 
     // Ne change pas d'image (reste sur 5.png)
     // Optionnel : ajoute un petit effet visuel (clignotement, vibration, etc.) si tu veux
   }, 5 * delay + randomDelay);
 }
 
 handleClick() {
   const now = performance.now();
   if (this.clicked) return; // éviter les doubles clics
 
   this.clicked = true;
 
   if (!this.canClick) {
     // ❌ Faux départ
     this.reactionTime = 0;
     this.socketService.emit('reflex-clicked', { tooSoon: true });
   } else {
     // ✅ Bon départ
     this.reactionTime = now - this.reactionStartTime;
 
     this.socketService.emit('reflex-clicked', {
       tooSoon: false,
       time: this.reactionTime
     });
 
     if (this.createdGame && this.wallet) {
       this.reflexService.sendReactionTime(
         this.createdGame._id,
         this.wallet,
         this.reactionTime
       ).subscribe({
         next: (res) => console.log('Temps enregistré :', res),
         error: (err) => console.error('Erreur envoi du temps', err),
       });
     }
   }
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
    this.startLightsSequence();

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
}

}
