const express = require('express')
const bodyParser = require('body-parser')
const ws = require('ws')
var fs = require('fs')
const path = require('path')
const multer  = require('multer')
const sqlite3 = require('sqlite3'),  TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
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

const db = new TransactionDatabase(new sqlite3.Database('reduxDB'))

const createUser = (login, password, name, surname, description) => {
    db.run(`INSERT INTO users (login, password, Username, Surname, description) VALUES (?, ?, ?, ?, ?)`, [login, password, name, surname, description], function(err) {
        if (err) {
          console.error(err);
          console.log('Error saving user to database')
        } else {
          console.log(`User with ID ${this.lastID} saved to database`)
        }
    })
}

const getAll = () => {
    db.run(`SELECT * FROM users`, function(err, res){
        if(err){
            console.log(err)
        } else {console.log(res); return res}
    })
}

const findUser = (username) => {
    db.get(`SELECT login, password FROM users WHERE login = '${username}'`, function(err, result){
        if(err){
            console.error(err)
            console.log('Error')
        } 
        else{
            user = result
        }
    })
}

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
    createUser(body.login, body.password, body.name, body.surname, body.description)
})

app.get('/user/:username', (req, res) => {
    const { username, password } = req.params
    db.get(`SELECT * FROM users WHERE login = '${username}'`, function(err, result){
        if(err){
            console.error(err)
            console.log('Error')
        }
        else{
            return res.json(result)
        }
    })
})
app.get('/login/:username/:password', (req, res) => {
    const { username, password } = req.params
    db.get(`SELECT * FROM users WHERE login = '${username}'`, function(err, result){
        if(err){
            console.error(err)
            console.log('Error')
        } 
        else{
            if (result.password === password)
                return res.json(result)
        }
    })
})

app.get('/getUsers', (req, res) => {
  db.all('SELECT * FROM users', (err, result) => {
    if(err){
      console.error(err)
      console.log('Error')
    } 
    else{
      console.log(result)
        return res.json(result)
    }
  })
})

app.post('/sendPhoto', upload.single('files'),  function async (req, res) {
    let dir = `./images/${req.body.login}/`
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    let oldPath = `./images/${req.file.originalname}`
    let newPath = `./images/${req.body.login}/${req.file.originalname}`
    fs.rename(oldPath, newPath, function (err) {
        if (err) throw err
        console.log('Successfully Moved File')
    })

    let data = {
        login: req.body.login,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        dateCreate: Date('now')
    }

    let sql ='INSERT INTO userPhoto (login, filename, mimetype, size, dateCreate) VALUES (?,?,?,?,?)'
    let params = [data.login, data.filename, data.mimetype, data.size, Date('now')]

    db.run(sql, params, function (err, result) {
        if (err){
            res.status(400).json({"error": err.message})
            return;
        }
    });   

    res.status(200).json(req.file)
})

app.get('/getPhoto/:login', (req, res) => {
    const {login} = req.params
  db.get('SELECT * FROM userPhoto WHERE login = ?', [login], (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    } else if (!row) {
      res.status(404).send('Photo not found');
    } else {
      const filename = row.filename;
      const filepath = `images/${login}/` + filename;
      fs.readFile(filepath, (err, data) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Server Error');
        } else {
          res.setHeader('Content-Type', 'image/*');
          res.send(data);
        }
      });
    }
  });
})
app.get('/users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    if(err){
      console.error(err)
    }
    else{
      res.json(rows)
    }
  })
} )
app.get('/getMessages/:userFrom/:userTo', (req, res) => {
  const {userFrom, userTo} = req.params
  db.all('SELECT * FROM Messages WHERE userFrom = ? AND userTo = ?', [userFrom, userTo], (err, rows) => {
    if(err){
      console.error("Error: " + err)
    }else if (!rows) {
      res.status(404).send('Messages not found');
    } else {
      return res.json(rows)
    }
  })
})

app.use('/images/posts', express.static(path.join(__dirname, 'images/posts')));

app.get('/getPosts', (req, res) => {
  db.all('SELECT * FROM posts', (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    } else if (!row) {
      res.status(404).send('Photo not found');
    } else {
      res.status(200).json(row)
    }
  } )
})
app.post('/createPost', upload.single('photo'), (req, res) => {
  const { login, name, surname, description } = req.body;
  const photo = req.file;
  if (photo){
    const photoPath = path.join(__dirname, 'images/posts', photo.filename);
    fs.renameSync(photo.path, photoPath);
  }

  const query = 'INSERT INTO posts (login, name, surname, description, photo) VALUES (?, ?, ?, ?, ?)';
  db.run(query, [login, name, surname, description, photo? photo.filename: ''], function (err) {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при сохранении записи в базу данных');
    } else {
      res.send('Запись успешно сохранена в базе данных');
    }
  });
})

app.get('/getPosts/:login', (req, res) => {
  const {login} = req.params
  db.all(`SELECT * FROM posts WHERE login = '${login}'`, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при сохранении записи в базу данных');
    } else {
      res.json(rows);
    }
  })
})

app.put('/like', (req, res) => {
  const {id} = req.body
  db.get(`SELECT * FROM posts WHERE ID = ${id}`, (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при сохранении записи в базу данных');
    } else {
      console.log(row)
      db.run(`UPDATE posts SET like = '${Number.parseInt(row.like) + 1}'  WHERE ID = '${id}'`, (err, rows) => {
        if (err) {
          console.error(err)
          res.status(500).send('Ошибка при сохранении записи в базу данных');
        } else {
          res.json(rows);
        }
      })
    }
  })
})

app.put('/unlike', (req, res) => {
  const {id} = req.body
  db.get(`SELECT * FROM posts WHERE ID = ${id}`, (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).send('Ошибка при сохранении записи в базу данных');
    } else {
      console.log(row)
      db.run(`UPDATE posts SET like = '${Number.parseInt(row.like) - 1}'  WHERE ID = '${id}'`, (err, rows) => {
        if (err) {
          console.error(err)
          res.status(500).send('Ошибка при сохранении записи в базу данных');
        } else {
          res.json(rows);
        }
      })
    }
  })
})


//_____________WebSocket_________________


const io = require("socket.io")({
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});


io.on('connect', (socket) => {
  console.log('A user connected');

  socket.on('message', (data) => {
    const {message, userFrom, userTo} = data
    let sql = `INSERT INTO Messages (message, userFrom, userTo, date) VALUES (?,?,?,?)`
    let params = [message, userFrom, userTo, Date('now')]
    db.run(sql, params, (err, result) => {
      if(err){
        console.error(err)
      }
      else{
        console.log(result)
      }
    })
  });
  // socket.on('inChat', (data) => {
  //   const {userFrom, userTo} = data
  //   let sql = `SELECT * FROM Messages WHERE (userFrom = '${userFrom}' AND userTo = '${userTo}') OR (userFrom = '${userTo}' AND userTo = '${userFrom}') `
  //   db.all(sql, (err, result) => {
  //     if(err){
  //       console.error(err)
  //     }
  //     else{
  //       socket.emit(result)
  //     }
  //   })
  // })
});

io.listen(5500, () => {
  console.log('Server listening on port 5500');
});


//_________________________________________________


app.listen(port, () => console.log(`Listening on port ${port}!`))