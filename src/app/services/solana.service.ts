// solana.service.ts
import { Injectable } from '@angular/core';
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction
} from '@solana/web3.js';

@Injectable({
  providedIn: 'root',
})
export class SolanaService {
  private quickNodeUrl = 'https://powerful-necessary-breeze.solana-mainnet.quiknode.pro/fab7e8bb4d07de3b4d88a3a62363907c6f408570/';
  private connection = new Connection(this.quickNodeUrl, 'confirmed');
  private receiverAddress = new PublicKey('BsxyTzNWAU79exdU9Uj4YSr5N7nGQAXprETP6eYQNsmy');
  transactionStatus = '';
  isLoading = false;
  solBalance: number | null = null;
  
  async fetchBalance(wallet: string) {
    if (!wallet) return;
    try {
      const pubkey = new PublicKey(wallet);
      const balanceLamports = await this.connection.getBalance(pubkey, 'confirmed');
      this.solBalance = balanceLamports / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Erreur récupération solde :', error);
      this.solBalance = null;
    }
  }

  async createDepositTransaction(wallet: string, depositAmount: number): Promise<string> {
  if (!wallet || depositAmount <= 0) {
    this.transactionStatus = 'Montant invalide ou wallet non connecté.';
    throw new Error('Montant invalide ou wallet non connecté.');
  }

  this.isLoading = true;
  this.transactionStatus = 'Traitement de la transaction...';

  try {
    const sender = new PublicKey(wallet);
    const receiver = this.receiverAddress;

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    if (!blockhash) throw new Error('Blockhash introuvable');

    const lamports = depositAmount * LAMPORTS_PER_SOL;

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
    if (!provider || !provider.signTransaction) {
      throw new Error('Phantom Wallet non détecté ou non compatible.');
    }

    const signedTx = await provider.signTransaction(transaction);
    const txId = await this.connection.sendRawTransaction(signedTx.serialize());
    await this.connection.confirmTransaction(txId, 'confirmed');

    this.transactionStatus = `Transaction confirmée ! ID: ${txId}`;
    await this.fetchBalance(wallet);

    return txId; // ✅ On retourne bien le txId ici
  } catch (error) {
    console.error('Erreur de dépôt :', error);
    this.transactionStatus = 'Erreur lors du dépôt.';
    throw new Error('Erreur lors du dépôt.');
  } finally {
    this.isLoading = false;
  }
}

}
