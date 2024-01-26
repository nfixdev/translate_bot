import nodemon from "nodemon";
nodemon({
    target: 'app.js',
    ext: 'js'
})

nodemon.on('start', ()=>{
    console.log('Скрипт запущен!');
}).on('stop', ()=>{
    console.log('Скрипт остановлен!');
}).on('reload', (msg)=>{
    console.log('Скрипт перезапущен: ' + msg);
});
