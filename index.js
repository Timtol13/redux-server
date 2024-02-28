const express = require('express')
const bodyParser = require('body-parser')
var fs = require('fs')
const path = require('path')
const multer  = require('multer')
const { Pool } = require('pg');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

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

const app = express()

app.use(bodyParser.json());
app.use(
    express.urlencoded(),
    cors({
        origin: ['http://localhost:3000', 'http://localhost:8014', 'http://localhost:5173']
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

app.get('/get-user/:id', (req, res) => {
  const { id } = req.params
  const query = 'SELECT * FROM users WHERE id = $1'
  db.query(query, [id], (err, result) => {
    if(err) res.status(500)
    else res.status(200).json(result.rows[0])
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
    }else {
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


// app.put('/like', (req, res) => {
//   const { id, login } = req.body;

//   db.query(`SELECT "like" FROM posts WHERE ID = $1`, [id], (err, result) => {
//     if (err) {
//       console.error(err);
//       res.status(500).send('Ошибка при получении записи из базы данных');
//     } else {
//       let currentLikes = result.rows[0]?.like;
//       const elementToDelete = login
//       const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
//       newArray.push(login); 
//       const arrayLenght = newArray.length;
//       console.log(arrayLenght)
//       db.query('UPDATE posts SET "like" = $1 WHERE ID = $2', [newArray, id], (err, updateResult) => {
//         if (err) {
//           console.error(err);
//           res.status(500).send('Ошибка при обновлении записи в базе данных');
//         } else {
//           res.json({'users': newArray, 'count': arrayLenght});
//         }
//       });
//     }
//     });
//   });

// app.put('/unlike', (req, res) => {
//   const { id, login } = req.body;

//   db.query(`SELECT "like" FROM posts WHERE ID = $1`, [id], (err, result) => {
//     if (err) {
//       console.error(err);
//       res.status(500).send('Ошибка при получении записи из базы данных');
//     } else {
//       let currentLikes = result.rows[0].like;
//       const elementToDelete = login
//       const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
//       console.log(currentLikes)
//       console.log(newArray)
//       const arrayLenght = newArray.length;
//       db.query('UPDATE posts SET "like" = $1 WHERE ID = $2', [newArray, id], (err, updateResult) => {
//         if (err) {
//           console.error(err);
//           res.status(500).send('Ошибка при обновлении записи в базе данных');
//         } else {
//           res.json({'users': newArray, 'count': arrayLenght});
//         }
//       });
//     }
//   });
// });

// app.put('/likePhoto', (req, res) => {
//   const { login, likeTo, filename } = req.body;
//   console.log(login, filename)

//   db.query(`SELECT * FROM userphoto WHERE "login" = $1 AND "filename" = $2`, [likeTo, filename], (err, result) => {
//     if (err) {
//       console.error(err);
//       res.status(500).send('Ошибка при получении записи из базы данных');
//     } else {
//       let currentLikes = result.rows[0]?.like;
//       const elementToDelete = login
//       const newArray = currentLikes?.filter(item => item !== elementToDelete && item != '');
//       newArray?.push(login);
//       const arrayLenght = newArray?.length;
//       console.log(arrayLenght)
//       db.query('UPDATE userphoto SET "like" = $1 WHERE "login" = $2 AND "filename" = $3', [newArray, likeTo, filename], (err, updateResult) => {
//         if (err) {
//           console.error(err);
//           res.status(500).send('Ошибка при обновлении записи в базе данных');
//         } else {
//           res.json({'users': newArray, 'count': arrayLenght});
//         }
//       });
//     }
//   });
// });

app.put('/dislikePhoto', (req, res) => {
  db.query(`UPDATE userphoto SET "like" = array_remove("like", $1) WHERE ID = $2 RETURNING "like"`, [login, id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при обновлении записи в базе данных');
    } else {
      const newArray = result.rows[0].like;
      const arrayLength = newArray.length;
      res.json({'users': newArray, 'count': arrayLength});
    }
  });
});

app.put('/commentPhoto', (req, res) => {
  const { login, filename, name, surname, date, message } = req.body;

  db.query(
    `UPDATE userphoto 
     SET "comments" = array_remove(coalesce("comments", ARRAY[]::jsonb[]), '') || $1 
     WHERE "login" = $2 AND "filename" = $3
     RETURNING "comments"`,
    [[{ name, surname, message, date, login }], login, filename],
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send('Ошибка при обновлении записи в базе данных');
      } else {
        const updatedComments = result.rows[0].comments;
        const count = updatedComments.length;
        res.json({ comments: updatedComments, count });
      }
    }
  );
});



//_____________WebSocket_________________

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"], 
    allowedHeaders: ["my-custom-header"], 
    credentials: true 
  }
});


// const io = require("socket.io")({
//   cors: {
//     origin: "http://localhost:3000",
//     methods: ["GET", "POST"]
//   }
// });

io.on('connection', (socket) => {
  var login = ''
  socket.on('message', (data) => {
    const { message, userFrom, userTo } = JSON.parse(data).content;
    const currentDate = new Date();
    const sql = `INSERT INTO message (message, userFrom, userTo, date, type) VALUES ($1, $2, $3, $4, 'message')`;
    const values = [message, userFrom, userTo, currentDate];
    // console.log(socket.adapter.rooms)
  
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Ошибка при добавлении сообщения:", err);
      } else {
        console.log("Сообщение успешно добавлено в базу данных");
        return io.emit('newMessage', { message, userFrom, userTo, date: currentDate });
        // console.log(socket.to(userFrom).emit('newMessage', { message, userFrom, userTo, date: currentDate }));
        // console.log(socket.to(userTo).emit('newMessage', { message, userFrom, userTo, date: currentDate }));
      }
    });
  });
  socket.on('commentPhoto', (data) => {
    const { login, filename, name, surname, date, message } = data;
    db.query(
      `UPDATE userphoto 
      SET "comments" = array_remove(coalesce("comments", ARRAY[]::varchar[]), '') || $1 
      WHERE "login" = $2 AND "filename" = $3
      RETURNING "comments"`,
      [[{ name, surname, message, date, login }], login, filename],
      (err, result) => {
        if (err) {
          console.error(err);
          socket.emit('Ошибка при обновлении записи в базе данных');
        } else {
          const updatedComments = result.rows[0]?.comments;
          const count = updatedComments?.length;
          socket.emit('getComments', { comments: updatedComments, count })
        }
      }
    );
  })
  socket.on('connectToChat', (room) => {
    socket.join(room?.login); 
    db.query('UPDATE users SET status = $1 WHERE login = $2', ['online', room], (err, result) => {
      if (err) {
        console.error('Error updating status:', err);
      } else {
        socket.to(room).emit('online')
      }
    });
    socket.to(room).emit('connectToChat', room);
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

  socket.on('disconnectUser', (room) => {
    db.query('UPDATE users SET status = $1 WHERE login = $2', ['offline', room], (err, result) => {
      if (err) {
        console.error('Error updating status:', err);
      } else {
        socket.to(room).emit('online')
      }
    });
    socket.to(room).emit('disconnectUser', room);
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
        socket.to(socket.id).emit('inChat', result);
      }
    });
    
  })
  socket.on('likePost', ({id, login}) => {
    db.query(`UPDATE posts SET "like" = array_append("like", $1) WHERE ID = $2 RETURNING "like"`, [login, id], (err, result) => {
      if (err) {
        console.error(err);
      } else {
        const newArray = result.rows[0].like;
        const arrayLength = newArray.length;
        socket.to(socket.id).emit('newLike');
      }
    });
  });
  
  socket.on('dislikePost', ({id, login}) => {
    db.query(`UPDATE posts SET "like" = array_remove("like", $1) WHERE ID = $2 RETURNING "like"`, [login, id], (err, result) => {
      if (err) {
        console.error(err);
      } else {
        const newArray = result.rows[0].like;
        const arrayLength = newArray.length;
        socket.to(socket.id).emit('newLike');
      }
    });
  });
  
  socket.on('likePhoto', ({login, likeTo, filename}) => {
    console.log({login, likeTo, filename});
    db.query(
      `SELECT "like" FROM userphoto WHERE "login" = $1 AND "filename" = $2`,
      [likeTo, filename],
      (selectErr, selectResult) => {
          if (selectErr) {
              console.error(selectErr + 'qwe');
          } else {
              const currentLikes = selectResult.rows[0]?.like || [];

              const updatedLikes = [...currentLikes, login];
              const updatedRow = updatedLikes;
              const arrayLength = updatedLikes.length || 0;
              message = `Пользователю ${login} понравилось ваше фото`;
              socket.to(likeTo).emit('newLike', { login, message, arrayLength });
              db.query(
                  `UPDATE userphoto SET "like" = $1 WHERE "login" = $2 AND "filename" = $3 RETURNING *`,
                  [updatedLikes, likeTo, filename],
                  (updateErr, updateResult) => {
                      if (updateErr) {
                          console.error(updateErr);
                      } else {
                          console.log('OK')
                      }
                  }
              );
          }
      }
    );
  })
  socket.on('dislikePhoto', ({id, login}) => {
    db.query(`UPDATE userphoto SET "like" = array_remove("like", $1) WHERE ID = $2 RETURNING "like"`, [login, id], (err, result) => {
      if (err) {
        console.error(err);
      } else {
        const newArray = result.rows[0].like;
        const arrayLength = newArray.length;
      }
    });
  })
  socket.on("upload", (file, filename, userFrom, userTo, callback) => {
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
        return io.emit('newMessage', newMessage);
      }
    });

  });
  // socket.on('disconnect', () => {
  //   db.query('UPDATE users SET status = $1 WHERE login = $2', ['offline', login], (err, result) => {
  //     if (err) {
  //       console.error('Error updating status:', err);
  //       res.status(500).json({ error: 'Server Error' });
  //     } else {
  //       io.emit({ message: 'Status updated successfully' });
  //     }
  //   });
  // });
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

//___________________SCRUM DESK_________________

app.get('/get-all-projects/:login', (req, res) => {
  const { login } = req.params
  const query = 'SELECT projects.*, users.login FROM projects JOIN users ON projects.creator = users.login WHERE users.login = $1 OR $1 = ANY(projects.users);'
  db.query(query, [login], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200).json(result.rows);
    }
  })
})

app.get('/get-project-by-id/:id', (req, res) => {
  const { id } = req.params
  const query = 'SELECT * FROM projects WHERE id = $1'
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200).json(result.rows[0]);
    }
  })
})

app.post('/create-project', (req, res) => {
  const { name, description, typeProject, usersProject, username, peoples_count } = req.body
  const query = 'INSERT INTO projects(name, type, description, peoples_count, creator, users) VALUES ($1, $2, $3, $4, $5, $6)'
  db.query(query, [name, typeProject, description, peoples_count + 1, username, usersProject], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200).json({ message: 'Project created successfully' });
    }
  })
})

app.get('/get-tasks/:id', (req, res) => {
  const { id } = req.params
  const query = 'SELECT * FROM tasks WHERE project_id = $1'
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200).json(result.rows);
    }
  })
})

app.post('/create-task', (req,res) => {
  const {name, description, executor_id, creator, project_id, status} = req.body
  const query = 'INSERT INTO tasks(name, description, executor_id, creator, project_id, status) VALUES ($1, $2, $3, $4, $5, $6)'
  db.query(query, [name, description, executor_id, creator, project_id, status], (err, result) => {
    if(err){
      console.error(err)
      res.status(500).send('Something went wrong!')
    }else {
      res.status(200).send('OK')
    }
  })
})

app.post('/update-users-list', (req, res) => {
  const { id, users } = req.body;
  const usersAsString = users.map(el => JSON.stringify(el));
  const query = 'UPDATE projects SET users = users || $1 WHERE id = $2';
  db.query(query, [usersAsString, id], (err, result) => {
    if(err){
      console.error(err);
      res.status(500).send('Something went wrong!');
    }else {
      res.status(200).send('OK');
    }
  });
});



app.put('/set-complited/:id', (req, res) => {
  const { id } = req.params
  const query = `UPDATE tasks SET status = 'completed' WHERE id = ${id}`
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200)
    }
  })
})
app.put('/set-postponed/:id', (req, res) => {
  const { id } = req.params
  const query = `UPDATE tasks SET status = 'postponed' WHERE id = ${id}`
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200)
    }
  })
})
app.put('/set-inWork/:id', (req, res) => {
  const { id } = req.params
  const query = `UPDATE tasks SET status = 'inWork' WHERE id = ${id}`
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200)
    }
  })
})

app.delete('/remove-task/:id', (req, res) => {
  const { id } = req.params
  const query = 'DELETE FROM tasks WHERE id = $1'
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200)
    }
  })
})
app.put('/update-executor/:id/:user_id', (req, res) => {
  const { id, user_id } = req.params
  const query = `UPDATE tasks SET executor_id = ${user_id} WHERE id = ${id}`
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Server Error' });
    } else {
      res.status(200)
    }
  })
})

//______________________________________________

server.listen(port, () => {
  console.log(`Listening on port ${port}!`); 
})