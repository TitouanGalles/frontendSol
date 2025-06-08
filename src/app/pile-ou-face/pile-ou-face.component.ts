import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  NgZone
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';
import { Game } from '../models/game'; 
// Three.js imports
import * as THREE from 'three';
import { SocketService } from '../services/socket.service';
import { SolanaService } from '../services/solana.service';




@Component({
  selector: 'app-pile-ou-face',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './pile-ou-face.component.html',
  styleUrls: ['./pile-ou-face.component.scss'],
  providers: [{ provide: Window, useValue: Window}]
})
export class PileOuFaceComponent implements OnInit, OnDestroy, AfterViewInit {
  games: Game[] = [];
  newGame = { choice: 'pile', amount: 0 };
  errorMsg = '';

  chemin = "https://solapp.onrender.com";

  showCountdown = false;
  countdownValue = 0;
  buttonCloseModal = false;

  wallet: string | null = null;
  pseudo: string | null = null;

  waitingModal = false;
  showResultModal = false;
  showTimerModal = false;
  countdown = 3;

  private refreshGamesInterval: any;
  private pollingInterval: any;
  private countdownInterval: any;

  createdGame: Game | null = null;
  lastGameResult: Game | null = null;

  currentCoinFace: 'pile' | 'face' = 'pile';
  isAnimatingCoin = false;

  selected: 'pile' | 'face' = 'pile';
  transactionStatus: string | undefined;
  isLoading: boolean | undefined;
  winner: string | undefined = '';

  select(choice: 'pile' | 'face') {
    this.selected = choice;
    this.newGame.choice = choice; // synchronise avec le champ existant
  }

  AlertVisible = false;
  notifications: { message: string }[] = [];
  isResultVisible = false;


  // Three.js variables
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private coin!: THREE.Mesh;
  private animationFrameId: any;

  // Pour la scène modale
  private modalScene!: THREE.Scene;
  private modalCamera!: THREE.PerspectiveCamera;
  private modalRenderer!: THREE.WebGLRenderer;
  private modalCoin!: THREE.Mesh;
  

  constructor(private http: HttpClient, private userService: UserService, private ngZone: NgZone, private window: Window, private socketService: SocketService, private solanaService: SolanaService) {}

  ngOnInit() {
    this.buttonCloseModal = false;
    this.userService.wallet$.subscribe(w => this.wallet = w);
    this.userService.pseudo$.subscribe(p => this.pseudo = p);
    //this.loadGames();

    //this.refreshGamesInterval = setInterval(() => this.loadGames(), 1000);

    this.socketService.listen<Game>('player-joined').subscribe(updatedGame => {
      if (this.createdGame && updatedGame._id === this.createdGame._id) {
        this.createdGame = updatedGame;

        // Si les 2 joueurs sont là, démarrer la partie
        if (updatedGame.playerPseudo && updatedGame.opponentPseudo) {
          this.startGameWithCountdown();
        }
      }
    });

    this.socketService.emit('request-waiting-games');

    this.socketService.listen<{ result: 'pile' | 'face' }>('game-started').subscribe(data => {
      console.log("listen game started")
      this.createdGame!.result = data.result;
      this.startGameWithCountdown();
      this.createdGame!.status = 'terminer';
    });

    this.socketService.listen<Game>('game-created').subscribe(game => {
      if (game.status === 'waiting') {
        this.games.push(game);
      }
    });

    this.socketService.listen<Game>('game-updated').subscribe(updatedGame => {
      console.log("update");
      const index = this.games.findIndex(g => g._id === updatedGame._id);
      if (index !== -1) {
        if (updatedGame.status === 'waiting') {
          this.games[index] = updatedGame;
        } else {
          this.games.splice(index, 1); // retirer si plus waiting
        }
      }
    });

    this.socketService.listen<void>('gameSupp').subscribe(() => {
      this.loadGames(); // recharge toutes les parties waiting
    });

    this.socketService.listen<Game[]>('waiting-games').subscribe(games => {
      this.games = games;
    });

  }

  startGameWithCountdown() {
    console.log("✅ Lancement du compte à rebours");
    this.showCountdown = true;
    this.countdownValue = 3;

    const interval = setInterval(() => {
      this.countdownValue--;

      if (this.countdownValue === 0) {
        clearInterval(interval);
        this.showCountdown = false;
        this.launchModalCoinAnimation(this.createdGame?.result)
      }
    }, 1000);
  }

  

  ngAfterViewInit() {
    const container = document.getElementById('three-container');
    if (!container) return;
  
    const width = container.clientWidth;
    const height = container.clientHeight;
  
    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    this.camera.position.z = 2;
  
    this.scene = new THREE.Scene();
  
    const loader = new THREE.TextureLoader();
    const pileTexture = loader.load('PileSolTourner.png');
    const faceTexture = loader.load('FaceSolTourner.png');
  
    pileTexture.center.set(0.5, 0.5);
    faceTexture.center.set(0.5, 0.5);
  
    const pileMaterial = new THREE.MeshBasicMaterial({ map: pileTexture });
    const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xd4af37 });
  
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 64);
  
    this.coin = new THREE.Mesh(geometry, [
      edgeMaterial,
      faceMaterial,
      pileMaterial
    ]);
  
    this.coin.rotation.x = Math.PI / 2;
  
    this.scene.add(this.coin);
  
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(2, 2, 2);
    this.scene.add(light);
  
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);
  
    this.animate();
  
    // Lancer animation test
    //this.launchModalCoinAnimation('pile');
  }
  

  ngOnDestroy() {
    clearInterval(this.pollingInterval);
    clearInterval(this.countdownInterval);
    clearInterval(this.refreshGamesInterval);
    cancelAnimationFrame(this.animationFrameId);
  }
  showNotification(message: string) {
    const notif = { message };
    this.notifications.push(notif);

    setTimeout(() => {
      this.notifications = this.notifications.filter(n => n !== notif);
    }, 4000); // durée d'affichage
  }

  sortAsc = true;

  get sortedParties() {
    return this.games.slice().sort((a, b) => {
      return this.sortAsc
        ? a.amount - b.amount
        : b.amount - a.amount;
    });
  }

  toggleSort() {
    this.sortAsc = !this.sortAsc;
  }

  loadGames() {
    this.http.get<Game[]>(`${this.chemin}/games`).subscribe({
      next: data => this.games = data.filter(g => g.status === 'waiting'),
      error: () => this.errorMsg = 'Erreur chargement des parties'
    });
  }

  async depositAndCreateGame() {
    if (!this.wallet) {
      this.errorMsg = 'Wallet not connected.';
      this.showNotification(this.errorMsg);
      return;
    }
    if (!this.wallet || this.newGame.amount <= 0.0099) {
      this.errorMsg = 'Invalid amount, minimum amount = 0.01';
      this.showNotification(this.errorMsg);
      return;
    }

    this.isLoading = true;
    this.transactionStatus = 'Dépôt en cours...';

    try {
      const txId = await this.solanaService.createDepositTransaction(this.wallet, this.newGame.amount);

      if (txId) {
        this.transactionStatus = `Transaction confirmée ! ID: ${txId}`;
        // ✅ Créer la partie uniquement après confirmation
        this.createGame();
      } else {
        throw new Error('Transaction non signée.');
      }
    } catch (error) {
      console.error('Erreur de dépôt :', error);
      this.transactionStatus = 'Erreur lors du dépôt ou transaction annulée.';
    } finally {
      this.isLoading = false;
    }
  }

  async joinGameWithDeposit(gameId: string, amount: number) {
  if (!this.wallet) {
    this.transactionStatus = 'Wallet not connected.';
    return;
  }

  this.isLoading = true;
  this.transactionStatus = 'Dépôt en cours...';

  // helper timeout
  const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout de transaction dépassé.'));
      }, ms);

      promise.then((value) => {
        clearTimeout(timer);
        resolve(value);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  try {
    await this.http.post(`${this.chemin}/api/games/lock/${gameId}`, {}).toPromise();

    const txId = await timeout(
      this.solanaService.createDepositTransaction(this.wallet, amount),
      15000 // ⏱ 15 secondes timeout
    );

    if (txId) {
      this.transactionStatus = `Transaction confirmée ! ID: ${txId}`;
      this.joinGame(gameId);
    } else {
      throw new Error('Transaction non signée.');
    }

  } catch (error) {
    console.error('Erreur de dépôt (join) :', error);
    this.transactionStatus = 'Erreur ou délai dépassé lors du dépôt.';

    await this.http.post(`${this.chemin}/api/games/unlock/${gameId}`, {}).toPromise();
  } finally {
    this.isLoading = false;
  }
}



  createGame() {
    if (!this.wallet || !this.pseudo) {
      this.errorMsg = 'Wallet et pseudo requis';
      this.showNotification(this.errorMsg);
      return;
    }

    if (this.newGame.amount <= 0) {
      this.errorMsg = 'Montant invalide';
      this.showNotification(this.errorMsg);
      return;
    }
  
    this.http.post<Game>(`${this.chemin}/games`, {
      player: this.wallet,
      choice: this.newGame.choice,
      amount: this.newGame.amount
    }).subscribe({
      next: game => {
        this.createdGame = game;
        this.waitingModal = true;
        this.pollGameStatus(game._id);
        //this.loadGames();
        this.newGame.amount = 0;
        this.errorMsg = '';
  
        // Rejoindre la room Socket.io liée à cette partie
        this.socketService.joinGameRoom(game._id);
  
        // Envoyer le jeu sur socket pour notifier les autres
        this.socketService.sendGame(game);
      },
      error: () => this.errorMsg = 'Erreur création partie'
    });
  }
  
  

  joinGame(gameId: string) {
    if (!this.wallet || !this.pseudo) {
      this.errorMsg = 'Wallet et pseudo requis';
      return;
    }

    this.http.post<Game>(`${this.chemin}/games/${gameId}/join`, {
      player: this.wallet,
      pseudo: this.pseudo
    }).subscribe({
      next: updatedGame => {
        console.log(this.createdGame);
        this.createdGame = updatedGame;
        console.log(this.createdGame);
        this.waitingModal = true;
        this.socketService.joinGameRoom(updatedGame._id);
        this.socketService.sendGame(updatedGame);
        this.errorMsg = '';
        //this.loadGames();

        this.http.post<{ result: 'pile' | 'face' }>(
          `${this.chemin}/games/${this.createdGame?._id}/start`, {}
        ).subscribe();
      },
      error: () => this.errorMsg = 'Erreur rejoindre partie'
    });
  }

  

  

  pollGameStatus(gameId: string) {
    this.pollingInterval = setInterval(() => {
      this.http.get<Game>(`${this.chemin}/games/${gameId}`).subscribe({
        next: game => {
          this.createdGame = game;
          console.log(game.status);
          if (game.status === 'finished') {
            clearInterval(this.pollingInterval);
            this.waitingModal = false;
            this.lastGameResult = game;

            this.showTimerModal = true;
            this.startCountdown(() => {
              this.showTimerModal = false;
              this.showResultModal = true;
              this.currentCoinFace = game.result!;
            });

            this.createdGame = null;
            //this.loadGames();
          }
        },
        error: () => {console.error('Erreur polling')
          clearInterval(this.pollingInterval);
          this.waitingModal = false;
          this.createdGame = null;
        }
      });
    }, 2000);
  }

  startCountdown(callback: () => void) {
    this.countdown = 3;
    this.isAnimatingCoin = false;
    clearInterval(this.countdownInterval);
  
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        clearInterval(this.countdownInterval);
        // Lance l’animation avec le résultat voulu, par ex. lastGameResult.result
        if(this.createdGame && this.createdGame.result) {
          this.launchModalCoinAnimation(this.createdGame.result);
        }
        // Après durée de l'animation, lance le callback
        setTimeout(() => {
          this.isResultVisible = true;
          
          callback();
        }, 1600);
      }
    }, 1000);
  }
  

  closeModal() {
    this.showResultModal = false;
    this.lastGameResult = null;
  }


  animate = () => {
    if (this.coin) {
      this.coin.rotation.z += 0.03; // rotation verticale (de droite à gauche)
    }
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.animate);
  };


  spinCoin() {
    // Extra rotation or effect could be added here
    this.coin.rotation.x += Math.PI * 2;
    this.coin.rotation.y += Math.PI * 1;
  }

  finishGame(gameId: string) {
    this.http.post<Game>(`${this.chemin}/games/${gameId}/finish`, {}).subscribe({
      next: game => {
        this.lastGameResult = game;
        this.showResultModal = true;
      },
      error: () => this.errorMsg = 'Erreur fin de partie'
    });
  }

  launchModalCoinAnimation(result: 'pile' | 'face' | undefined) {
    const container = document.getElementById('three-container-modal');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Caméra
    this.modalCamera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    this.modalCamera.position.z = 2;

    // Scène
    this.modalScene = new THREE.Scene();

    // Textures
    const loader = new THREE.TextureLoader();
    const pileTexture = loader.load('PileSolTourner.png');
    const faceTexture = loader.load('FaceSolTourner.png');
    pileTexture.center.set(0.5, 0.5);
    faceTexture.center.set(0.5, 0.5);

    // Matériaux
    const pileMaterial = new THREE.MeshBasicMaterial({ map: pileTexture });
    const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xd4af37 });

    // Géométrie de la pièce
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 64);
    this.modalCoin = new THREE.Mesh(geometry, [edgeMaterial, faceMaterial, pileMaterial]);
    this.modalCoin.rotation.x = Math.PI / 2;
    this.modalScene.add(this.modalCoin);

    // Lumière
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(2, 2, 2);
    this.modalScene.add(light);

    // Renderer
    this.modalRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.modalRenderer.setSize(width, height);
    container.innerHTML = ''; // Nettoie avant d’ajouter
    container.appendChild(this.modalRenderer.domElement);

    // Animation
    const duration = 1500;
    const pauseDuration = 1000;
    const startTime = performance.now();
    const initialCameraZ = this.modalCamera.position.z;
    const zoomAmount = 1;
    let totalRotations = 4;
    if (result === 'pile') {
      totalRotations += 0.5;
    }
    const targetY = result === 'pile' ? 0 : Math.PI;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animateFlip = (time: number) => {
      const elapsed = time - startTime;
      let progress = elapsed / duration;
      if (progress > 1) progress = 1;

      const easedProgress = easeOutCubic(progress);
      this.modalCoin.rotation.x = Math.PI / 2 + easedProgress * totalRotations * 2 * Math.PI;
      this.modalCoin.rotation.y = targetY * easedProgress;

      if (progress < 0.5) {
        this.modalCamera.position.z = initialCameraZ - zoomAmount * (progress / 0.5);
      } else {
        this.modalCamera.position.z = initialCameraZ - zoomAmount * (1 - (progress - 0.5) / 0.5);
      }

      this.modalRenderer.render(this.modalScene, this.modalCamera);

      if (progress < 1) {
        requestAnimationFrame(animateFlip);
      } else {
        this.modalCoin.rotation.x = Math.PI / 2;
        this.modalCoin.rotation.y = targetY;
        this.modalCamera.position.z = initialCameraZ;

        setTimeout(() => {
          console.log('Animation terminée sur :', result);
          this.winner = result;
          this.isResultVisible = true;
          const gameId = this.createdGame?._id;
          console.log(this.createdGame, gameId);
          if (gameId) {
            console.log("appel finish", gameId, this.createdGame);
            this.http.post(`${this.chemin}/games/${gameId}/finish`, {})
              .subscribe({
                next: (updatedGame: any) => {
                  this.showNotification("🎉 Partie terminée, paiement effectué !");
                  this.createdGame = updatedGame; // Pour afficher le gagnant ou la transaction dans la modale par exemple
                  console.log(this.createdGame);

                },
                error: (err) => {
                  this.showNotification("❌ Erreur lors de la fin de partie.");
                  console.error(err);
                }
              });
          }
          this.buttonCloseModal = true;
        }, pauseDuration);
      }
    };

    requestAnimationFrame(animateFlip);
  }
 
  closeAllModal(){
    this.waitingModal=false;
    this.buttonCloseModal = false;
    this.winner = undefined;
  }

  onCancelClick() {
    if (confirm('Voulez-vous vraiment annuler et quitter la partie ?')) {
      this.cancelGame();
    }
  }

  cancelGame() {
    if (!this.wallet) {
      this.transactionStatus = 'wallet non connecté.';
      return;
    }
    if (!this.createdGame || !this.createdGame._id) return;
    this.deleteGame(this.createdGame._id).subscribe({
      next: () => {
        console.log('Partie supprimée avec succès');
        this.createdGame = null; // ou naviguer ailleurs
      },
      error: (err) => {
        console.error('Erreur suppression partie', err);
      }
    });
    this.closeAllModal();
  }

  deleteGame(id: string) {
    return this.http.delete(`${this.chemin}/api/games/${id}`);
  }

}