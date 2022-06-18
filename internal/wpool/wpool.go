package wpool

import (
	"context"
	"fmt"
	"sync"

	"golang.org/x/time/rate"
)

// JobID identifies a Job.
type JobID int

// ExecutionFn executes is the work to do associated with a Job.
type ExecutionFn func(ctx context.Context) (interface{}, error)

// Result is the result of running a Job.
type Result struct {
	ID    JobID
	Value interface{}
	Err   error
}

// Job is a job to be executed.
type Job struct {
	ID     JobID
	ExecFn ExecutionFn
}

func (j Job) execute(ctx context.Context) Result {
	value, err := j.ExecFn(ctx)
	if err != nil {
		return Result{
			ID:  j.ID,
			Err: err,
		}
	}

	return Result{
		ID:    j.ID,
		Value: value,
	}
}

func worker(ctx context.Context, wg *sync.WaitGroup, jobs <-chan Job, results chan<- Result, limiter *rate.Limiter) {
	defer wg.Done()
	for {
		select {
		case job, ok := <-jobs:
			if !ok {
				return
			}
			// fan-in job execution multiplexing results into the results channel
			if err := limiter.Wait(ctx); err != nil {
				results <- Result{ID: job.ID, Err: err}
				return
			}
			results <- job.execute(ctx)
		case <-ctx.Done():
			fmt.Printf("canceled worker. Error detail: %v\n", ctx.Err())
			results <- Result{
				Err: ctx.Err(),
			}
			return
		}
	}
}

// WorkerPool manages a pool of workers to execute Jobs.
type WorkerPool struct {
	workersCount int
	limiter      *rate.Limiter
	jobs         chan Job
	results      chan Result
	Done         chan struct{}
}

// New create a new WorkerPool.
func New(wcount int, rateLim rate.Limit) WorkerPool {
	return WorkerPool{
		workersCount: wcount,
		limiter:      rate.NewLimiter(rateLim, 1),
		jobs:         make(chan Job, wcount),
		results:      make(chan Result, wcount),
		Done:         make(chan struct{}),
	}
}

// Run starts running the WorkerPool.
func (wp WorkerPool) Run(ctx context.Context) {
	var wg sync.WaitGroup

	for i := 0; i < wp.workersCount; i++ {
		wg.Add(1)
		// fan out worker goroutines
		//reading from jobs channel and
		//pushing calcs into results channel
		go worker(ctx, &wg, wp.jobs, wp.results, wp.limiter)
	}

	wg.Wait()
	close(wp.Done)
	close(wp.results)
}

// Results returns a channel on which the Job Results can be read.
func (wp WorkerPool) Results() <-chan Result {
	return wp.results
}

// GenerateFrom feeds the WorkerPool with Jobs.
func (wp WorkerPool) GenerateFrom(jobsBulk []Job) {
	for i := range jobsBulk {
		wp.jobs <- jobsBulk[i]
	}
	close(wp.jobs)
}
