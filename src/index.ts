import { HubConnectionBuilder, HubConnection } from '@aspnet/signalr';
import { useState, useEffect } from 'react';

interface RC<T> {
    count: number,
    ref: T
}

declare global {
    type Predicate<T> = (t: T) => boolean;
    interface Array<T> {
        firstOrDefault: (predicate: Predicate<T>, def: T) => T;
    }
}

Array.prototype.firstOrDefault = function <T>(predicate: Predicate<T>, def: T): T {
    for (let item of this) {
        if (predicate(item)) {
            return item;
        }
    }
    return def;
};

interface SignalrContext {
    connections: Array<RC<{ url: string, conn: HubConnection }>>
}

const signalrContext: SignalrContext = {
    connections: []
};

export function useSignalr(url: string, methodName: string) {
    const [message, sendMessage] = useState();
    useEffect(() => {
        const conn = signalrContext
            .connections
            .firstOrDefault(rc => url === rc.ref.url, {
                count: 0,
                ref: {
                    url,
                    conn: new HubConnectionBuilder()
                        .withUrl(url)
                        .build()
                }
            }).ref.conn;

        conn.start()
            .then(() => {
                const idx = signalrContext.connections.findIndex(rc => rc.ref.url === url);
                if (idx !== -1) {
                    signalrContext.connections[idx].count++;
                }
                else {
                    signalrContext.connections.push({
                        count: 1,
                        ref: {
                            url,
                            conn
                        }
                    });
                }
            })
            .catch(reason => {
                console.error(`Error when creating connection to ${url}.`);
                throw reason;
            });

        conn.on(methodName, data => sendMessage(data));

        return () => void conn.stop()
            .then(() => {
                const idx = signalrContext.connections.findIndex(rc => rc.ref.url === url);
                if (idx !== -1) {
                    signalrContext.connections[idx].count--;
                    if (signalrContext.connections[idx].count === 0) {
                        signalrContext.connections.splice(idx, 1);
                    }
                }
            })
            .catch(reason => {
                console.error(`Error when stopping connection to ${url}.`);
                throw reason;
            });
    })

    return message;
}
