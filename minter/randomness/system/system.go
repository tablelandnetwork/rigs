package system

import (
	"math/rand"
	"time"
)

// SystemRandomnessSource uses the rand module.
type SystemRandomnessSource struct {
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// NewSystemRandomnessSource creates a SystemRandomnessSource.
func NewSystemRandomnessSource() *SystemRandomnessSource {
	return &SystemRandomnessSource{}
}

// GenRandoms implements GenRandoms.
func (s *SystemRandomnessSource) GenRandoms(n int) ([]float64, error) {
	res := make([]float64, n)
	for i := 0; i < n; i++ {
		res[i] = rand.Float64()
	}
	return res, nil
}
