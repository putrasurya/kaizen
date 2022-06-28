import React from 'react';
import styles from './AppFooter.module.css';

function AppFooter() {
  return <footer className={styles.footer}>
    Made with <span style={{color: "#e25555"}}>&hearts;</span> by <a href="https://github.com/putrasurya" alt="Putra's Github Link" target="_blank" rel="noreferrer">PutraSurya</a>
  </footer>
}

export default AppFooter;