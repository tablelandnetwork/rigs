package wpool

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

const (
	jobsCount   = 10
	workerCount = 2
)

var (
	errDefault = errors.New("wrong argument type")
	jobID      = JobID(1)
	makeExecFn = func(val int, err bool) ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err {
				return nil, errDefault
			}
			return val * 2, nil
		}
	}
)

func Test_job_Execute(t *testing.T) {
	ctx := context.TODO()

	type fields struct {
		id     JobID
		execFn ExecutionFn
	}
	tests := []struct {
		name   string
		fields fields
		want   Result
	}{
		{
			name: "job execution success",
			fields: fields{
				id:     jobID,
				execFn: makeExecFn(10, false),
			},
			want: Result{
				Value: 20,
				ID:    jobID,
			},
		},
		{
			name: "job execution failure",
			fields: fields{
				id:     jobID,
				execFn: makeExecFn(10, true),
			},
			want: Result{
				Err: errDefault,
				ID:  jobID,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			j := Job{
				ID:     tt.fields.id,
				ExecFn: tt.fields.execFn,
			}

			got := j.execute(ctx)
			if tt.want.Err != nil {
				require.EqualError(t, got.Err, tt.want.Err.Error())
				return
			}

			require.Equal(t, got, tt.want)
		})
	}
}

func TestWorkerPool(t *testing.T) {
	wp := New(workerCount)

	ctx, cancel := context.WithCancel(context.TODO())
	defer cancel()

	go wp.GenerateFrom(testJobs())

	go wp.Run(ctx)

	for {
		select {
		case r, ok := <-wp.Results():
			if !ok {
				continue
			}

			val := r.Value.(int)
			if val != int(r.ID)*2 {
				t.Fatalf("wrong value %v; expected %v", val, r.ID*2)
			}
		case <-wp.Done:
			return
		}
	}
}

func TestWorkerPool_TimeOut(t *testing.T) {
	wp := New(workerCount)

	ctx, cancel := context.WithTimeout(context.TODO(), time.Nanosecond*10)
	defer cancel()

	go wp.Run(ctx)

	for {
		select {
		case r := <-wp.Results():
			if r.Err != nil && r.Err != context.DeadlineExceeded {
				t.Fatalf("expected error: %v; got: %v", context.DeadlineExceeded, r.Err)
			}
		case <-wp.Done:
			return
		}
	}
}

func TestWorkerPool_Cancel(t *testing.T) {
	wp := New(workerCount)

	ctx, cancel := context.WithCancel(context.TODO())

	go wp.Run(ctx)
	cancel()

	for {
		select {
		case r := <-wp.Results():
			if r.Err != nil && r.Err != context.Canceled {
				t.Fatalf("expected error: %v; got: %v", context.Canceled, r.Err)
			}
		case <-wp.Done:
			return
		}
	}
}

func testJobs() []Job {
	jobs := make([]Job, jobsCount)
	for i := 0; i < jobsCount; i++ {
		jobs[i] = Job{
			ID:     JobID(i),
			ExecFn: makeExecFn(i, false),
		}
	}
	return jobs
}
