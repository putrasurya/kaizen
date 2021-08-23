import { createContext, useReducer } from "react";

function reducer(state, action) {
  const { type, payload } = action;
  let updatedState;

  switch (type) {
    case "add": {
      const task = {
        id: new Date().getTime(),
        title: payload.title,
        seconds: payload.seconds,
        secondsSpent: payload.secondsSpent,
      };
      updatedState = [task, ...state];
      break;
    }

    case "update": {
      updatedState = state.map((task) => {
        if (task.id !== payload.id) return task;
        return {
          ...task,
          ...payload,
        };
      });
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
  window.localStorage.getItem("__myTimerTaskApp") || "[]"
);
const store = createContext(initialState);
const { Provider } = store;

function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addTask = (title, seconds, secondsSpent = 0, play = false) => {
    dispatch({
      type: "add",
      payload: {
        title,
        seconds,
        secondsSpent,
        play,
      },
    });
  };

  const updateSecondsSpent = (id, secondsSpent) => {
    dispatch({
      type: "update",
      payload: {
        id,
        secondsSpent,
      },
    });
  };

  return (
    <Provider
      value={{
        tasks: state,
        addTask,
        updateSecondsSpent,
      }}
    >
      {children}
    </Provider>
  );
}

export { store, StoreProvider };
