#ifndef __SLEEPING_H__
#define __SLEEPING_H__

/**
 * @brief Busy sleep for the given time (in nanoseconds). This is a precise sleeper. 
 * It uses a learned sleeper that gives the number of iterations to use.
 * 
 * @param sleeper 
 * @param ntime 
 */
static inline tiny_busy_sleep(struct sleeper_t *sleeper, int ntime) {
    for (int i = 0; i < (ntime/1000)*sleeper->scale; i++)
        asm("nop");
}

/**
 * @brief Block sleep for the given time (in nanoseconds). This is NOT a precise sleeper.
 * You don't need to learn the sleeping scale to use this sleeping mechanism. 
 * We use the nanosleep provided by the OS, expect a lot of jitter. 
  * 
 * @param ntime 
 */
static inline small_block_sleep(int ntime) {

}

/**
 * @brief Construct a new yield sleep object
 * 
 */
static inline yield_sleep() {

}


/**
 * @brief Learn the sleeping scale. This function is given time to sleep
 * and it learns the number of nop instructions to use.
 * 
 * @param sleeper 
 * @param ntime 
 */
static inline learn_sleeping(struct sleeper_t *sleeper, int ntime) {

}

#endif