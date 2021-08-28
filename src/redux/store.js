import { createContext, useReducer } from "react";

function reducer(state, action) {
  const { type, payload } = action;
  let updatedState;

  switch (type) {
    case "addTask": {
      const task = {
        id: new Date().getTime(),
        title: payload.title,
        seconds: payload.seconds,
        secondsSpent: payload.secondsSpent,
      };
      updatedState = { ...state, tasks: [task, ...state.tasks] };
      break;
    }

    case "updateTask": {
      updatedState = {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== payload.id) return task;
          return {
            ...task,
            ...payload,
          };
        }),
      };
      break;
    }

    case "deleteTask": {
      updatedState = {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== payload.id),
      };
      break;
    }

    case "addReminder": {
      const reminder = {
        id: new Date().getTime(),
        content: payload.content,
      };
      updatedState = { ...state, reminders: [reminder, ...state.reminders] };
      break;
    }

    case "deleteReminder": {
      updatedState = {
        ...state,
        reminders: state.reminders.filter(
          (reminder) => reminder.id !== payload.id
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

  window.localStorage.setItem("__myTimerTaskApp", JSON.stringify(updatedState));

  return updatedState;
}

const initialState = JSON.parse(
  window.localStorage.getItem("__myTimerTaskApp") ||
    JSON.stringify({ tasks: [], reminders: [], embeds: [] })
);
const store = createContext(initialState);
const { Provider } = store;

function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addTask = (title, seconds, secondsSpent = 0, play = false) => {
    dispatch({
      type: "addTask",
      payload: {
        title,
        seconds,
        secondsSpent,
        play,
      },
    });
  };

  const deleteTask = (id) => {
    dispatch({
      type: "deleteTask",
      payload: { id },
    });
  };

  const updateSecondsSpent = (id, secondsSpent) => {
    dispatch({
      type: "updateTask",
      payload: {
        id,
        secondsSpent,
      },
    });
  };

  const addReminder = (content) => {
    dispatch({
      type: "addReminder",
      payload: {
        content,
      },
    });
  };

  const deleteReminder = (id) => {
    dispatch({
      type: "deleteReminder",
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
        tasks: state.tasks,
        addTask,
        deleteTask,
        updateSecondsSpent,
        reminders: state.reminders,
        addReminder,
        deleteReminder,
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
