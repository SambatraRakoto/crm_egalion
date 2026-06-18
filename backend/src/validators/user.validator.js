'use strict';
// FR : Règles de validation des entrées utilisateurs.
// EN : Validation rules for user inputs.

const { body, param, query } = require('express-validator');
const { ROLE_LIST } = require('../utils/constants');

const idParam = [param('id').isUUID().withMessage('Identifiant utilisateur invalide')];

const listQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const update = [
  ...idParam,
  body('fullName').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide'),
  body('phone').optional({ values: 'falsy' }).isString(),
];

const setRoles = [
  ...idParam,
  body('roles').isArray({ min: 1 }).withMessage('Fournir au moins un rôle'),
  body('roles.*').isIn(ROLE_LIST).withMessage('Rôle invalide'),
];

const setActive = [...idParam, body('isActive').isBoolean().withMessage('isActive doit être un booléen')];

module.exports = { idParam, listQuery, update, setRoles, setActive };
