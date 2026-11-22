import { Routes } from '@angular/router';
import { activeProfileGuard, authGuard, roleGuard } from '../../core/auth/auth.guard';

export const QUESTION_SETS_ROUTES: Routes = [
    {
        path: 'question-sets',
        canActivate: [authGuard, roleGuard('TEACHER')],
        children: [
            {path: '', loadComponent: () => import('./pages/list-view').then((m) => m.QuestionSetsList), 
                title:"Question Sets List"},

            {path: 'new', loadComponent: () => import('./pages/edit').then((m) => m.QuestionSetEditor), 
                title:"New Question Set", canActivate: [activeProfileGuard]},

            {path: ':id', loadComponent: () => import('./pages/view').then((m) => m.QuestionSetDetail), 
                title:"Question Set"},
                
            {path: ':id/edit', loadComponent: () => import('./pages/edit').then((m) => m.QuestionSetEditor), 
                title:"Update Question Set", canActivate: [activeProfileGuard]},
        ]
    }
];
