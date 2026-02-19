// server/utils/constants.js
module.exports = {
    // Card colors
    COLORS: ['red', 'blue', 'green', 'yellow'],

    // Card types
    CARD_TYPES: {
        NUMBER: 'number',
        SKIP: 'skip',
        REVERSE: 'reverse',
        DRAW_TWO: 'draw_two',
        WILD: 'wild',
        WILD_DRAW_FOUR: 'wild_draw_four',
    },

    // Game settings
    GAME: {
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 10,
        INITIAL_HAND_SIZE: 7,
        TURN_TIMEOUT_MS: 30000,        // 30 seconds per turn
        RECONNECT_TIMEOUT_MS: 60000,   // 60 seconds to reconnect
        UNO_CALL_WINDOW_MS: 3000,      // 3 seconds to call UNO
    },

    // Currency rewards
    REWARDS: {
        WIN_GAME: 50,
        LOSE_GAME: 10,
        WIN_TOURNAMENT: 500,
        TOURNAMENT_RUNNER_UP: 200,
        DAILY_BONUS: 20,
    },

    // Game states
    GAME_STATE: {
        WAITING: 'waiting',
        PLAYING: 'playing',
        FINISHED: 'finished',
    },

    // Room states
    ROOM_EVENTS: {
        CREATE: 'room:create',
        JOIN: 'room:join',
        LEAVE: 'room:leave',
        LIST: 'room:list',
        STATE: 'room:state',
        START: 'game:start',
        PLAY_CARD: 'game:play',
        DRAW_CARD: 'game:draw',
        CALL_UNO: 'game:uno',
        CHALLENGE_UNO: 'game:challenge_uno',
        CHOOSE_COLOR: 'game:choose_color',
        TURN_TIMEOUT: 'game:timeout',
        GAME_OVER: 'game:over',
        CHAT_SEND: 'chat:send',
        CHAT_MSG: 'chat:message',
        CHAT_EMOJI: 'chat:emoji',
        ERROR: 'game:error',
        PLAYER_UPDATE: 'room:player_update',
        RECONNECT: 'room:reconnect',
    },

    // Chat moderation - basic word filter
    BLOCKED_WORDS: ['spam', 'hack', 'cheat'],
};
