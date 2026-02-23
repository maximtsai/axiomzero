'use strict';

const MESSAGE_BUS_CONSTANTS = {
    INDEX_THRESHOLD: 32767
};

class InternalMessageBus {
    constructor() {
        this.topics = {};
        this.index = 0;
    }

    /**
     * Registers a callback to be called when a message is published to a topic
     * @param {string} topic - The topic to subscribe to
     * @param {function} callback - The callback function
     * @param {object} target - The 'this' context for the callback
     * @returns {{unsubscribe: function, topic: string}} An object with an unsubscribe function
     */
    subscribe(topic, callback, target = null) {
        if (!topic) {
            console.error("Undefined subscription topic for callback: ");
            console.error(callback);
            return;
        }
        
        if (typeof callback !== 'function') {
            console.error("Topic " + topic + " encountered error with callback: ");
            console.log(callback);
            throw new Error('callback must be a function');
        }

        if (!this.topics.hasOwnProperty(topic)) {
            this.topics[topic] = {};
        }

        const indexId = this.index.toString();

        // callbacks are saved in unique index keys
        // We don't use arrays because if you unsubscribe,
        // then the array indices will be reordered after deletion
        this.topics[topic][indexId] = {
            callback: callback,
            target: target
        };
        
        this.index++;
        
        if (this.index > MESSAGE_BUS_CONSTANTS.INDEX_THRESHOLD) {
            console.warn(`WARNING: Subscriber threshold reached for topic ${topic}!`);
        }

        return {
            unsubscribe: () => {
                delete this.topics[topic][indexId];
                // Clean up empty topic objects
                if (Object.keys(this.topics[topic]).length === 0) {
                    delete this.topics[topic];
                }
            },
            topic: topic
        };
    }

    /**
     * Subscribe to a topic but auto-unsubscribe after the first message
     * @param {string} topic - The topic to subscribe to
     * @param {function} callback - The callback function
     * @param {object} target - The 'this' context for the callback
     * @returns {{unsubscribe: function, topic: string}} An object with an unsubscribe function
     */
    subscribeOnce(topic, callback, target = null) {
        const subscription = this.subscribe(topic, function(...args) {
            subscription.unsubscribe();
            callback.apply(target, args);
        });
        return subscription;
    }

    /**
     * Publish a message to a topic
     * @param {string} topic - The topic to publish to
     * @param {...*} args - Arguments to pass to subscribers
     */
    publish(topic, ...args) {
        if (!this.topics.hasOwnProperty(topic)) {
            return;
        }

        const callbacks = this.topics[topic];
        const errors = [];

        Object.keys(callbacks).forEach(key => {
            try {
                const obj = callbacks[key];
                obj.callback.apply(obj.target, args);
            } catch (error) {
                errors.push(error);
            }
        });

        if (errors.length > 0) {
            errors.forEach(error => console.error(error));
        }
    }

    /**
     * Clear all subscribers for a specific topic
     * @param {string} topic - The topic to clear
     */
    clearTopic(topic) {
        if (this.topics.hasOwnProperty(topic)) {
            delete this.topics[topic];
        }
    }

    /**
     * Clear all subscribers from all topics
     */
    clearAll() {
        this.topics = {};
        this.index = 0;
    }

    /**
     * Get the number of subscribers for a topic
     * @param {string} topic - The topic to check
     * @returns {number} The number of subscribers
     */
    getSubscriberCount(topic) {
        if (this.topics.hasOwnProperty(topic)) {
            return Object.keys(this.topics[topic]).length;
        }
        return 0;
    }

    /**
     * Check if a topic has any subscribers
     * @param {string} topic - The topic to check
     * @returns {boolean} True if the topic has subscribers
     */
    hasSubscribers(topic) {
        return this.getSubscriberCount(topic) > 0;
    }

    /**
     * Get list of all active topics
     * @returns {string[]} Array of topic names
     */
    getTopics() {
        return Object.keys(this.topics);
    }
}

const messageBus = new InternalMessageBus();
