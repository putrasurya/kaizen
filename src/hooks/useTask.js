import { useState } from "react";

function useTask() {
  const [tasks, setTasks] = useState([]);

  const addTask = (title, minutes, minutesSpent = 0, play = false) => {
    const task = {
      id: new Date().getTime(),
      title,
      minutes,
      minutesSpent,
      play,
    };
    setTasks([task, ...tasks]);
  };

  const playTask = (id) => {
    const updateTasks = tasks.map((task) => {
      if (task.id !== id) return task;
      return {
        ...task,
        play: true,
      };
    });
    setTasks(updateTasks);
  };

  const pauseTask = (id) => {
    const updateTasks = tasks.map((task) => {
      if (task.id !== id) return task;
      return {
        ...task,
        play: false,
      };
    });
    setTasks(updateTasks);
  };

  const oneMinuteSpent = (id) => {
    const updateTasks = tasks.map((task) => {
      if (task.id !== id) return task;
      return {
        ...task,
        minutesSpent: ++task.minutesSpent,
      };
    });
    setTasks(updateTasks);
  };

  return {
    tasks,
    addTask,
    playTask,
    pauseTask,
    oneMinuteSpent,
  };
}

export default useTask;
