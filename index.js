const express = require('express')
const bodyParser = require('body-parser')
var fs = require('fs')
const path = require('path')
const multer  = require('multer')
const { Pool } = require('pg');
const cors = require('cors')

const port = 7653


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = './images';
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

const db = new Pool({
  user: 'm',
  host: 'localhost',
  database: 'redux',
  password: '',
  port: 5432,
});

const createUser = (login, password, name, surname, description) => {
  
};
const app = express()

app.use(bodyParser.json());
app.use(
    express.urlencoded(),
    cors({
        origin: 'http://localhost:3000'
    })
)


app.post('/registration', (req, res) => {
    const body = req.body
    const query = `INSERT INTO users (login, password, username, surname, description) VALUES ($1, $2, $3, $4, $5)`;
    const values = [body.login, body.password, body.name, body.surname, body.description];
    let check
    db.query(`SELECT login FROM users WHERE login = $1`, [body.login], (err, result) =>{
      if(err){
        res.status(404).send('Ошибка!')
      }
      else if( result.rows[0] ){
        res.status(404).send('Пользователь уже существует!')
      } else {
        db.query(query, values, (err, result) => { 
          if (err) {
            console.error(err);
            console.log('Error saving user to database');
          } else {
            res.status(200).send('OK')
            console.log(`User saved to database`);
          }
        });
      }
    })


})

app.get('/getChats/:user', (req, res) => {
  const {user} = req.params
  const query = 'SELECT * FROM message WHERE userfrom = $1 OR userto = $1'

  db.query(query, [user], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Server Error');
    } else {
      var arr = []
      result?.rows?.map((e) => {
        if(e.userfrom === user){
          arr.push(e.userto)
        } else{
          arr.push(e.userfrom)
        }
      })
      var finalArr = [...new Set(arr)]
      res.json(finalArr);
    }
  })
})

app.get('/user/:username', (req, res) => {
  const { username } = req.params;
  const query = 'SELECT login, username, surname, description, status FROM users WHERE login = $1';

  db.query(query, [username], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Server Error');
    } else {
      res.json(result.rows);
    }
  });
});
app.put('/changeName/:login', (req, res) => {
  const { name, surname } = req.body;
  const {login} = req.params;
  db.query('UPDATE users SET username = $1, surname = $2 WHERE login = $3', [name, surname, login], (err, updateResult) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при обновлении записи в базе данных');
    } else {
      db.query('UPDATE posts SET name = $1, surname = $2 WHERE login = $3', [name, surname, login], (error, updateRes) => {
        if(updateRes){
          res.status(200).send('Okk');
        } else {
          console.error(error);
          res.status(500).send('Ошибка при обновлении записи в базе данных');
        }
      })
    }
  });
});
app.put('/changeDescription/:login', (req, res) => {
  const { description } = req.body;
  const {login} = req.params;

  db.query('UPDATE users SET description = $1 WHERE login = $2', [description, login], (err, updateResult) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при обновлении записи в базе данных');
    } else {
      res.status(200).send('Okk');
    }
  });
});

app.get('/login/:username/:password', (req, res) => {
  const { username, password } = req.params;
  const query = 'SELECT * FROM users WHERE login = $1';

  db.query(query, [username], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Server Error');
    } else {
      const user = result.rows[0];
      if (user && user.password === password) {
        res.json(user);
      } else {
        res.status(404).send('User not found or incorrect password');
      }
    }
  });
});


app.get('/getUsers', (req, res) => {
  const query = 'SELECT * FROM users';

  db.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Server Error');
    } else {
      res.json(result.rows);
    }
  });
});


app.post('/sendPhoto', upload.single('files'), async (req, res) => {
  const dir = `./images/${req.body.login}/`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const oldPath = `./images/${req.file.originalname}`;
  const newPath = `./images/${req.body.login}/${req.file.originalname}`;

  fs.rename(oldPath, newPath, (err) => {
    if (err) throw err;
    console.log('Successfully Moved File');
  });

  const data = {
    login: req.body.login,
    status: req.body.status,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    dateCreate: new Date().toISOString(),
  };

  const updateQuery = 'UPDATE userPhoto SET status = $1 WHERE login = $2';
  db.query(updateQuery, ['perv', data.login], (err) => {
    if (err) {
      console.log(err.message);
    }
  });

  const insertQuery =
    'INSERT INTO userPhoto (login, filename, mimetype, size, dateCreate, status, "like", "comments") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
  const params = [
    data.login,
    data.filename,
    data.mimetype,
    data.size,
    data.dateCreate,
    'main',
    [],
    []
  ];

  db.query(insertQuery, params, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    res.status(200).json(req.file);
  });
});



app.get('/getPhoto/:login', (req, res) => {
  const { login } = req.params;
  const query = 'SELECT * FROM userphoto WHERE login = $1 AND status = $2';

  db.query(query, [login, 'main'], (err, result) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    } else if (result.rows.length === 0) {
      res.status(404).send('Photo not found');
    } else {
      res.send(result.rows);
    }
  });
});

app.get('/getPhotos/:login', (req, res) => {
  const { login } = req.params;
  const query = 'SELECT * FROM userPhoto WHERE login = $1';

  db.query(query, [login], (err, result) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    } else if (!result.rows.length) {
      res.status(404).send('Photo not found');
    } else {
      res.send(result.rows);
    }
  });
});

app.get('/images/:login/:file', (req, res) => {
  const {login, file} = req.params;
  const filepath = `images/${login}/` + file;
  fs.readFile(filepath, (err, data) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    } else {
      res.setHeader('Content-Type', 'image/*');
      res.send(data);
    }
  });
})
app.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Server Error');
    } else {
      res.json(result.rows);
    }
  });
});

app.get('/getMessages/:userFrom/:userTo', (req, res) => {
  const { userFrom, userTo } = req.params;
  const query = 'SELECT * FROM message WHERE userFrom = $1 AND userTo = $2';

  db.query(query, [userFrom, userTo], (err, result) => {
    if (err) {
      console.error('Error:', err);
      res.status(500).send('Server Error');
    } else if (result.rows.length === 0) {
      res.status(404).send('Messages not found');
    } else {
      res.json(result.rows);
    }
  });
});

app.get('/images/messages/:userFrom/:userTo/:filename', (req, res) => {
  const { userFrom, userTo, filename } = req.params;
  const filepath = `images/messages/${userFrom}/${userTo}/${filename}`;

  fs.readFile(filepath, (err, data) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    } else {
      res.setHeader('Content-Type', 'image/*');
      res.send(data);
    }
  });
});


app.use('/images/posts', express.static(path.join(__dirname, 'images/posts')));
app.use('/images/:login', express.static(path.join(__dirname, 'images')));

app.get('/getPosts', (req, res) => {
  db.query('SELECT * FROM posts', (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Server Error');
    } else if (result.rows?.length === 0) {
      res.status(404).send('Posts not found');
    } else {
      res.status(200).json(result.rows);
    }
  });
});

app.post('/createPost', upload.single('photo'), (req, res) => {
  const { login, name, surname, description } = req.body;
  const photo = req.file;

  if (photo) {
    const photoPath = path.join(__dirname, 'images/posts', photo.filename);
    fs.renameSync(photo.path, photoPath);
  }

  const query = 'INSERT INTO posts (login, name, surname, description, photo) VALUES ($1, $2, $3, $4, $5)';
  const values = [login, name, surname, description, photo ? photo.filename : ''];

  db.query(query, values, function (err) {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при сохранении записи в базу данных');
    } else {
      res.send('Запись успешно сохранена в базе данных');
    }
  });
});

app.get('/getPosts/:login', (req, res) => {
  const { login } = req.params;
  const query = 'SELECT * FROM posts WHERE login = $1';

  db.query(query, [login], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении записей из базы данных');
    } else {
      res.json(result.rows);
    }
  });
});


app.put('/like', (req, res) => {
  const { id, login } = req.body;

  db.query(`SELECT "like" FROM posts WHERE ID = $1`, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении записи из базы данных');
    } else {
      let currentLikes = result.rows[0]?.like;
      const elementToDelete = login
      const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
      newArray.push(login); 
      const arrayLenght = newArray.length;
      console.log(arrayLenght)
      db.query('UPDATE posts SET "like" = $1 WHERE ID = $2', [newArray, id], (err, updateResult) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении записи в базе данных');
        } else {
          res.json({'users': newArray, 'count': arrayLenght});
        }
      });
    }
  });
});

app.put('/unlike', (req, res) => {
  const { id, login } = req.body;

  db.query(`SELECT "like" FROM posts WHERE ID = $1`, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении записи из базы данных');
    } else {
      let currentLikes = result.rows[0].like;
      const elementToDelete = login
      const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
      console.log(currentLikes)
      console.log(newArray)
      const arrayLenght = newArray.length;
      db.query('UPDATE posts SET "like" = $1 WHERE ID = $2', [newArray, id], (err, updateResult) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении записи в базе данных');
        } else {
          res.json({'users': newArray, 'count': arrayLenght});
        }
      });
    }
  });
});

app.put('/likePhoto', (req, res) => {
  const { login, likeTo, filename } = req.body;
  console.log(login, filename)

  db.query(`SELECT * FROM userphoto WHERE "login" = $1 AND "filename" = $2`, [likeTo, filename], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении записи из базы данных');
    } else {
      let currentLikes = result.rows[0]?.like;
      const elementToDelete = login
      const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
      newArray?.push(login);
      const arrayLenght = newArray?.length;
      console.log(arrayLenght)
      db.query('UPDATE userphoto SET "like" = $1 WHERE "login" = $2 AND "filename" = $3', [newArray, likeTo, filename], (err, updateResult) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении записи в базе данных');
        } else {
          res.json({'users': newArray, 'count': arrayLenght});
        }
      });
    }
  });
});

app.put('/dislikePhoto', (req, res) => {
  const { id, login } = req.body;

  db.query(`SELECT "like" FROM userphoto WHERE ID = $1`, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении записи из базы данных');
    } else {
      let currentLikes = result.rows[0].like;
      const elementToDelete = login
      const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
      console.log(currentLikes)
      console.log(newArray)
      const arrayLenght = newArray.length;
      db.query('UPDATE userphoto SET "like" = $1 WHERE ID = $2', [newArray, id], (err, updateResult) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении записи в базе данных');
        } else {
          res.json({'users': newArray, 'count': arrayLenght});
        }
      });
    }
  });
});

app.put('/commentPhoto', (req, res) => {
  const { login, filename, name, surname, date, message } = req.body;
  console.log(login, filename)

  db.query(`SELECT * FROM userphoto WHERE "login" = $1 AND "filename" = $2`, [login, filename], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при получении записи из базы данных');
    } else {
      let currentLikes = result.rows[0].comments;
      const newArray = currentLikes.filter(item => item !== '')
      console.log(newArray)
      newArray.push({name, surname, message, date, login}); 
      const arrayLenght = newArray.length;
      db.query('UPDATE userphoto SET "comments" = $1 WHERE "login" = $2 AND "filename" = $3', [newArray, login, filename], (err, updateResult) => {
        if (err) {
          console.error(err);
          res.status(500).send('Ошибка при обновлении записи в базе данных');
        } else {
          res.json({'comments': newArray, 'count': arrayLenght});
        }
      });
    }
  });
});


//_____________WebSocket_________________


const io = require("socket.io")({
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});


io.on('connection', (socket) => {
  socket.join()
  var login = ''
  socket.on('message', (data) => {
    const { message, userFrom, userTo } = data;
    const currentDate = new Date().toISOString();
    const sql = `INSERT INTO message (message, userFrom, userTo, date, type) VALUES ($1, $2, $3, $4, 'message')`;
    const values = [message, userFrom, userTo, currentDate];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Ошибка при добавлении сообщения:", err);
      } else {
        console.log("Сообщение успешно добавлено в базу данных");

        io.to(userTo).emit('newMessage', { message, userFrom, userTo, date: currentDate });
      }
    });

  });
  socket.on('connectToChat', (room) => {
    socket.join(room); 
    login = room
    io.to(room).emit('connectToChat', room);
  });
  socket.on('setOnline', (login) => {
    db.query('UPDATE users SET status = $1 WHERE login = $2', ['online', login], (err, result) => {
      if (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ error: 'Server Error' });
      } else {
        io.emit({ message: 'Status updated successfully' });
      }
    });
  })

  socket.on('inChat', (data)=>{
    const { userFrom, userTo } = data;
    const sql = `
      SELECT * 
      FROM message 
      WHERE (userFrom = $1 AND userTo = $2) OR (userFrom = $2 AND userTo = $1)
    `;
    const params = [userFrom, userTo];
    
    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('Ошибка при получении сообщений:', err.message);
      } else {
        io.to(socket.id).emit('inChat', result);
      }
    });
    
  })
  socket.on("upload", (file, filename, userFrom, userTo, callback) => {
    console.log(filename, userFrom, userTo);
    const bufferData = Buffer.from(file, 'binary');
    const filePath = `images/messages/${userFrom}/${userTo}/${filename}`; 
    const currentDate = new Date().toISOString();
    if (!fs.existsSync(`images/messages/${userFrom}/${userTo}`)){
        fs.mkdirSync(`images/messages/${userFrom}/${userTo}`, { recursive: true });
    }
    fs.writeFile(filePath, bufferData, 'binary', (err) => {
      if (err) {
        console.error('Error writing the file:', err);
      } else {
        console.log('File saved successfully!');
      }
    });
    const sql = `
      INSERT INTO message (message, userFrom, userTo, date, type)
      VALUES ($1, $2, $3, $4, 'file')
    `;
    const params = [filename, userFrom, userTo, currentDate];

    db.query(sql, params, (err) => {
      if (err) {
        console.error("Ошибка при добавлении сообщения:", err);
      } else {
        console.log("Сообщение успешно добавлено в базу данных");

        const newMessage = { filename, userFrom, userTo, date: currentDate };
        io.to(userTo).emit('newMessage', newMessage);
      }
    });

  });
  socket.on('disconnect', () => {
    db.query('UPDATE users SET status = $1 WHERE login = $2', ['offline', login], (err, result) => {
      if (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ error: 'Server Error' });
      } else {
        io.emit({ message: 'Status updated successfully' });
      }
    });
  });
});

io.listen(5500, () => {
  console.log('Server listening on port 5500');
});


//_________________________________________________


//__________________Check Online________________
// app.post('/setOnline/:login', (req, res) => {
//   const { login } = req.params;
//   db.query('UPDATE users SET status = $1 WHERE login = $2', ['online', login], (err, result) => {
//     if (err) {
//       console.error('Error updating status:', err);
//       res.status(500).json({ error: 'Server Error' });
//     } else {
//       res.status(200).json({ message: 'Status updated successfully' });
//     }
//   });
// });

// app.post('/setOffline/:login', (req, res) => {
//   const { login } = req.params;
//   db.query('UPDATE users SET status = $1 WHERE login = $2', ['offline', login], (err, result) => {
//     if (err) {
//       console.error('Error updating status:', err);
//       res.status(500).json({ error: 'Server Error' });
//     } else {
//       res.status(200).json({ message: 'Status updated successfully' });
//     }
//   });
// });


//______________________________________________

app.listen(port, () => console.log(`Listening on port ${port}!`))