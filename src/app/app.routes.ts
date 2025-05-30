import { Routes } from '@angular/router';
import { AccueilComponent } from './accueil/accueil.component';
import { PileOuFaceComponent } from './pile-ou-face/pile-ou-face.component';
import { ReflexGameComponent } from './reflexe/reflexe.component';

export const routes: Routes = [
  //{ path: '', component: AccueilComponent },
  { path: '', component: PileOuFaceComponent },
  { path: 'reflex', component: ReflexGameComponent}
];
