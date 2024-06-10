import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid';
import {Telegraf} from 'telegraf';
import {config} from 'dotenv';

config();

let base_packet = {
    gas: 5,
    photoresistor: 20,
    motion: false,
    temp: 25,
    humidity: 54
}

let packet = {
    gas: base_packet.gas,
    photoresistor: base_packet.photoresistor,
    motion: base_packet.motion,
    temp: base_packet.temp,
    humidity: base_packet.humidity
};

function getPacket() {
    if (is_on) {
        return packet;
    }
    
    const null_packet = {
        gas: 0,
        photoresistor: 0,
        motion: false,
        temp: 0,
        humidity: 0
    };
    
    return null_packet;
}

const botCommands = ['help', 'gas', 'photoresistor', 'motion', 'temp', 'humidity'];

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command(botCommands[0], (ctx) => {
    ctx.reply(
        `Справка по командам:\n` +
        `1. /${botCommands[0]} - Справка по командам\n` +
        `2. /${botCommands[1]} - Получить значение с датчика газа\n` +
        `3. /${botCommands[2]} - Получить значение с фоторезистора\n` +
        `4. /${botCommands[3]} - Получить значение с датчика движения\n` +
        `5. /${botCommands[4]} - Получить значение с датчика температуры\n` +
        `6. /${botCommands[5]} - Получить значение с датчика влажности`
    );
})

bot.command(botCommands[1], (ctx) => {
    ctx.reply(`${getPacket().gas} %`);
})

bot.command(botCommands[2], (ctx) => {
    ctx.reply(`${getPacket().photoresistor} %`);
})

bot.command(botCommands[3], (ctx) => {
    ctx.reply(`${getPacket().motion ? 'Есть движение' : 'Нет движения'}`);
})

bot.command(botCommands[4], (ctx) => {
    ctx.reply(`${getPacket().temp} °C`);
})

bot.command(botCommands[5], (ctx) => {
    ctx.reply(`${getPacket().humidity} %`);
})

bot.launch();

process.once('SIGINT', () => {
    bot.stop('SIGINT');
})

process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
})

let is_on = false;

const clients = [];

const ws = new WebSocketServer({port: process.env.PORT || 8080});

ws.on('connection', (socket, request) => {
    //console.log(`[${getLocalTime()}] Подключение клиента ${request.socket.remoteAddress}`);
    
    /*if (!is_on) {
        socket.destroy();
        console.log(`[${getLocalTime()}] Соединение сброшено`);
    }*/
    
    const id = uuidv4();
    
    clients[id] = {
        sock: socket,
        is_main: false
    };
    
    socket.on('message', (msg) => {
        //console.log(`[${getLocalTime()}] Принят пакет от ${request.socket.remoteAddress}`);
        
        const data = JSON.parse(msg);
        
        if (data.main) {
            clients[id].is_main = true;
            return;
        }
        
        if (clients[id].is_main) {
            if (data.on) {
                is_on = true;
                return;
            }
            
            if (data.off) {
                is_on = false;
                return;
            }
            
            base_packet.gas = data.gas ?? base_packet.gas;
            base_packet.photoresistor = data.photoresistor ?? base_packet.photoresistor;
            base_packet.motion = data.motion ?? base_packet.motion;
            base_packet.temp = data.temp ?? base_packet.temp;
            base_packet.humidity = data.humidity ?? base_packet.humidity;
        }
    })
    
    socket.on('close', () => {
        //console.log(`[${getLocalTime()}] Отключение клиента ${request.socket.remoteAddress}`);
        
        delete clients[id];
    })
})

setInterval(() => {
    packet.gas = Math.min(100, base_packet.gas + getRandomInt(0, 1));
    packet.photoresistor = Math.min(100, base_packet.photoresistor + getRandomInt(0, 1));
    packet.motion = base_packet.motion;
    packet.temp = Math.min(100, base_packet.temp + getRandomInt(0, 1));
    packet.humidity = Math.min(100, base_packet.humidity + getRandomInt(0, 1));

    for (const id in clients) {
        if (!clients[id].is_main) {
            clients[id].sock.send(JSON.stringify(getPacket()));
            
            //console.log(`[${getLocalTime()}] Пакет отправлен`);
        }
    }
    
}, 1500)

function getLocalTime() {
    const date = new Date();
    
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    
    return `${hours}:${minutes}:${seconds}`;
}

function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}