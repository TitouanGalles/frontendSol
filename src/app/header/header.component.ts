import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';

interface User {
  wallet: string;
  pseudo: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  walletAddress: string | null = null;
  pseudo: string | null = null;
  isConnected = false;
  solBalance: number | null = null;
  solBalanceUSD: number | null = null;
  depositAmount = 0;
  isLoading = false;
  transactionStatus = '';
  pseudoInput = '';
  errorMsg = '';
  showGameList = false;
  isLoadingPseudo = false;

  chemin = "https://solapp.onrender.com";
  private quickNodeUrl = 'https://mainnet.helius-rpc.com/?api-key=cb2851f0-e2d7-481a-97f1-04403000595e';
  private connection = new Connection(this.quickNodeUrl, 'confirmed');

  games = [
    { label: 'Pile ou Face', path: '' },
    { label: 'Réflexe', path: 'reflex' },
  ];

  constructor(private http: HttpClient, private userService: UserService, private router: Router) {}

  async connectWallet() {
    const provider = (window as any).solana;
    if (!provider?.isPhantom) {
      alert("Phantom Wallet n'est pas installé.");
      return;
    }

    try {
      const resp = await provider.connect();
      this.walletAddress = resp.publicKey.toString();
      this.isConnected = true;
      this.userService.setUser(this.walletAddress, null);
      await this.loadOrCreateUser();
      await this.fetchBalance();
    } catch (err) {
      console.error("Erreur de connexion au wallet :", err);
    }
  }

  async disconnectWallet() {
    const provider = (window as any).solana;
    if (provider?.isPhantom) await provider.disconnect();

    this.walletAddress = null;
    this.pseudo = null;
    this.isConnected = false;
    this.depositAmount = 0;
    this.solBalance = null;
    this.solBalanceUSD = null;
    this.transactionStatus = '';
    this.errorMsg = '';
    this.pseudoInput = '';
    this.userService.clearUser();
  }

  async fetchBalance() {
    if (!this.walletAddress) return;

    try {
      const pubkey = new PublicKey(this.walletAddress);
      const balanceLamports = await this.connection.getBalance(pubkey, 'confirmed');
      this.solBalance = balanceLamports / LAMPORTS_PER_SOL;

      const price = await this.getSolanaPriceUSD();
      this.solBalanceUSD = this.solBalance * price;
    } catch (error) {
      console.error('Erreur récupération solde :', error);
      this.solBalance = null;
      this.solBalanceUSD = null;
    }
  }

  async getSolanaPriceUSD(): Promise<number> {
    try {
      const response: any = await this.http
        .get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
        .toPromise();

      return response?.solana?.usd || 0;
    } catch (err) {
      console.error("Erreur récupération prix SOL :", err);
      return 0;
    }
  }

  async createDepositTransaction() {
    if (!this.walletAddress || this.depositAmount <= 0) {
      this.transactionStatus = 'Montant invalide ou wallet non connecté.';
      return;
    }

    this.isLoading = true;
    this.transactionStatus = 'Traitement de la transaction...';

    try {
      const sender = new PublicKey(this.walletAddress);
      const receiver = new PublicKey("BsxyTzNWAU79exdU9Uj4YSr5N7nGQAXprETP6eYQNsmy");

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const lamports = this.depositAmount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: receiver,
          lamports,
        })
      );
      transaction.feePayer = sender;
      transaction.recentBlockhash = blockhash;

      const provider = (window as any).solana;
      const signedTx = await provider.signTransaction(transaction);
      const txId = await this.connection.sendRawTransaction(signedTx.serialize());
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.transactionStatus = `Transaction confirmée ! ID: ${txId}`;
      await this.fetchBalance();
    } catch (error) {
      console.error('Erreur de dépôt :', error);
      this.transactionStatus = 'Erreur lors du dépôt.';
    } finally {
      this.isLoading = false;
    }
  }

  async refreshBalanceDisplay() {
    await this.fetchBalance();
  }

  loadOrCreateUser() {
    if (!this.walletAddress) return;
    this.isLoadingPseudo = true;

    this.http.get<User>(`${this.chemin}/users/${this.walletAddress}`).subscribe({
      next: user => {
        this.pseudo = user.pseudo;
        this.pseudoInput = user.pseudo;
        this.userService.setUser(this.walletAddress, this.pseudo);
        this.errorMsg = '';
        this.isLoadingPseudo = false;
      },
      error: () => {
        this.pseudo = null;
        this.pseudoInput = '';
        this.userService.setUser(this.walletAddress, null);
        this.isLoadingPseudo = false;
      }
    });
  }

  createUser() {
    if (!this.walletAddress || !this.pseudoInput.trim()) {
      this.errorMsg = 'Pseudo requis';
      return;
    }

    this.http.post<User>(`${this.chemin}/users`, {
      wallet: this.walletAddress,
      pseudo: this.pseudoInput.trim()
    }).subscribe({
      next: user => {
        this.pseudo = user.pseudo;
        this.userService.setUser(this.walletAddress, this.pseudo);
        this.errorMsg = '';
      },
      error: () => this.errorMsg = 'Erreur création utilisateur'
    });
  }

  toggleGameList() {
    this.showGameList = !this.showGameList;
  }

  selectGame(game: { label: string; path: string }) {
    this.showGameList = false;
    this.router.navigate([game.path]);
  }
}
