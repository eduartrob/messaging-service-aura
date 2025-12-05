// src/infrastructure/messaging/RabbitMQPublisher.js

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

class RabbitMQPublisher {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
        this.EXCHANGE_NAME = 'aura_events';
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 5;
    }

    async connect() {
        try {
            const rabbitURL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

            console.log('🐰 Conectando a RabbitMQ...');
            this.connection = await amqp.connect(rabbitURL);

            this.connection.on('error', (err) => {
                console.error('❌ Error en conexión RabbitMQ:', err.message);
                this.isConnected = false;
            });

            this.connection.on('close', () => {
                console.warn('⚠️ Conexión RabbitMQ cerrada');
                this.isConnected = false;
                this.reconnect();
            });

            this.channel = await this.connection.createChannel();

            // Declarar exchange tipo topic para routing flexible
            await this.channel.assertExchange(this.EXCHANGE_NAME, 'topic', {
                durable: true
            });

            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('✅ RabbitMQ conectado exitosamente');

        } catch (error) {
            console.error('❌ Error conectando a RabbitMQ:', error.message);
            this.isConnected = false;
            this.reconnect();
        }
    }

    async reconnect() {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error('❌ Máximo de intentos de reconexión alcanzado');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

        setTimeout(() => this.connect(), delay);
    }

    /**
     * Publicar evento a RabbitMQ
     * @param {string} eventType - Tipo de evento (ej: 'MESSAGE_RECEIVED')
     * @param {object} payload - Datos del evento
     * @param {string} routingKey - Clave de ruteo (ej: 'messaging.message.received')
     */
    async publishEvent(eventType, payload, routingKey = 'messaging.event') {
        if (!this.isConnected || !this.channel) {
            console.warn('⚠️ RabbitMQ no conectado, evento no publicado:', eventType);
            return false;
        }

        try {
            const event = {
                eventId: uuidv4(),
                eventType,
                timestamp: new Date().toISOString(),
                payload
            };

            const message = Buffer.from(JSON.stringify(event));

            this.channel.publish(
                this.EXCHANGE_NAME,
                routingKey,
                message,
                {
                    persistent: true,
                    contentType: 'application/json'
                }
            );

            console.log(`📤 Evento publicado: ${eventType} (ID: ${event.eventId})`);
            return true;

        } catch (error) {
            console.error(`❌ Error publicando evento ${eventType}:`, error.message);
            return false;
        }
    }

    async close() {
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
            this.isConnected = false;
            console.log('🔌 RabbitMQ desconectado');
        } catch (error) {
            console.error('❌ Error cerrando RabbitMQ:', error.message);
        }
    }
}

// Singleton instance
const rabbitMQPublisher = new RabbitMQPublisher();

module.exports = rabbitMQPublisher;
