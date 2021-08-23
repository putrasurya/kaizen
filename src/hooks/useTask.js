import { useReducer } from "react";

function reducer(state, action) {
  const { type, payload } = action;
  switch (type) {
    case "add": {
      const task = {
        id: new Date().getTime(),
        title: payload.title,
        seconds: payload.seconds,
        secondsSpent: payload.secondsSpent,
        play: payload.play,
      };
      return [task, ...state];
    }

    default: {
      return state;
    }
  }
}

function useTask() {
  const [state, dispatch] = useReducer(reducer, []);

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

  return {
    tasks: state,
    addTask,
  };
}

export default useTask;
