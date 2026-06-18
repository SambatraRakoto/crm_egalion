'use strict';
// FR : Règles de validation des entrées d'authentification.
// EN : Validation rules for auth inputs.

const { body } = require('express-validator');
const { ROLE_LIST } = require('../utils/constants');

const strongPassword = (field) =>
  body(field)
    .isString()
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/[A-Za-z]/)
    .withMessage('Le mot de passe doit contenir au moins une lettre')
    .matches(/\d/)
    .withMessage('Le mot de passe doit contenir au moins un chiffre');

const register = [
  body('fullName').trim().notEmpty().withMessage('Le nom complet est requis'),
  body('email').trim().isEmail().withMessage('Email invalide').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).isString(),
  strongPassword('password'),
  body('roles').optional().isArray().withMessage('roles doit être un tableau'),
  body('roles.*').optional().isIn(ROLE_LIST).withMessage('Rôle invalide'),
];

const login = [
  body('email').trim().isEmail().withMessage('Email invalide').normalizeEmail(),
  body('password').notEmpty().withMessage('Le mot de passe est requis'),
];

const refresh = [body('refreshToken').notEmpty().withMessage('refreshToken requis')];

const changePassword = [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  strongPassword('newPassword'),
];

const forgotPassword = [body('email').trim().isEmail().withMessage('Email invalide').normalizeEmail()];

const resetPassword = [
  body('token').notEmpty().withMessage('Token requis'),
  strongPassword('newPassword'),
];

module.exports = { register, login, refresh, changePassword, forgotPassword, resetPassword };
