const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', (req, res) => {
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.execute(
      'SELECT * FROM usuarios WHERE username = ? AND password = ?',
      [username, password]
    );

    if (rows.length > 0) {
      const user = rows[0];

      req.session.user = {
        id: user.id_usuario,
        username: user.username,
        isAdmin: user.es_admin === 1 
      };
      res.redirect('/tabla');
    } else {
      res.render('login', { error: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error('Error de login:', error);
    res.render('login', { error: 'Error en el servidor' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
