import { createContext, useReducer } from "react";

function reducer(state, action) {
  const { type, payload } = action;
  let updatedState;

  switch (type) {
    case "addTimer": {
      const timer = {
        id: new Date().getTime(),
        title: payload.title,
        seconds: payload.seconds,
        secondsSpent: payload.secondsSpent,
      };
      updatedState = { ...state, timers: [timer, ...state.timers] };
      break;
    }

    case "updateTimer": {
      updatedState = {
        ...state,
        timers: state.timers.map((timer) => {
          if (timer.id !== payload.id) return timer;
          return {
            ...timer,
            ...payload,
          };
        }),
      };
      break;
    }

    case "deleteTimer": {
      updatedState = {
        ...state,
        timers: state.timers.filter((timer) => timer.id !== payload.id),
      };
      break;
    }

    case "addNote": {
      const note = {
        id: new Date().getTime(),
        content: payload.content,
      };
      updatedState = { ...state, notes: [note, ...state.notes] };
      break;
    }

    case "deleteNote": {
      updatedState = {
        ...state,
        notes: state.notes.filter(
          (note) => note.id !== payload.id
        ),
      };
      break;
    }

    case "addEmbed": {
      updatedState = {
        ...state,
        embeds: [
          { id: new Date().getTime(), link: payload.link },
          ...(state.embeds || []),
        ],
      };
      break;
    }

    case "deleteEmbed": {
      updatedState = {
        ...state,
        embeds: (state.embeds || []).filter((embed) => embed.id !== payload.id),
      };
      break;
    }

    default: {
      updatedState = state;
    }
  }

  window.localStorage.setItem(process.env.REACT_APP_STORAGEKEY, JSON.stringify(updatedState));

  return updatedState;
}

const initialState = JSON.parse(
  window.localStorage.getItem(process.env.REACT_APP_STORAGEKEY) ||
    JSON.stringify({ timers: [], notes: [], embeds: [] })
);
const store = createContext(initialState);
const { Provider } = store;

function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addTimer = (title, seconds, secondsSpent = 0, play = false) => {
    dispatch({
      type: "addTimer",
      payload: {
        title,
        seconds,
        secondsSpent,
        play,
      },
    });
  };

  const deleteTimer = (id) => {
    dispatch({
      type: "deleteTimer",
      payload: { id },
    });
  };

  const updateSecondsSpent = (id, secondsSpent) => {
    dispatch({
      type: "updateTimer",
      payload: {
        id,
        secondsSpent,
      },
    });
  };

  const addNote = (content) => {
    dispatch({
      type: "addNote",
      payload: {
        content,
      },
    });
  };

  const deleteNote = (id) => {
    dispatch({
      type: "deleteNote",
      payload: { id },
    });
  };

  const addEmbed = (link) => {
    dispatch({
      type: "addEmbed",
      payload: {
        link,
      },
    });
  };

  const deleteEmbed = (id) => {
    dispatch({
      type: "deleteEmbed",
      payload: { id },
    });
  };

  return (
    <Provider
      value={{
        timers: state.timers,
        addTimer,
        deleteTimer,
        updateSecondsSpent,
        notes: state.notes,
        addNote,
        deleteNote,
        embeds: state.embeds,
        addEmbed,
        deleteEmbed,
      }}
    >
      {children}
    </Provider>
  );
}

export { store, StoreProvider };
