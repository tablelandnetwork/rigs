package nullable

import (
	"database/sql"
	"encoding/json"
)

// String wraps a sql.NullString to provide custom JSON.
type String struct {
	sql.NullString
}

type fromStringConfig struct {
	emptyIsNull bool
}

// FromStringOption controls the behavior of FromString.
type FromStringOption func(*fromStringConfig)

// EmptyIsNull specifies that empty string should be considered null.
func EmptyIsNull() FromStringOption {
	return func(fsc *fromStringConfig) {
		fsc.emptyIsNull = true
	}
}

// FromString creates a NullableString.
func FromString(s string, opts ...FromStringOption) String {
	c := fromStringConfig{}
	for _, opt := range opts {
		opt(&c)
	}
	valid := true
	if c.emptyIsNull && s == "" {
		valid = false
	}
	return String{NullString: sql.NullString{String: s, Valid: valid}}
}

// MarshalJSON implements MarshalJSON.
func (ns *String) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.String)
}

// UnmarshalJSON implements UnmarshalJSON.
func (ns *String) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &ns.String)
	ns.Valid = (err == nil)
	return err
}

// Int16 wraps a sql.NullInt16 to provide custom JSON.
type Int16 struct {
	sql.NullInt16
}

// FromInt16 creates a NullableInt16.
func FromInt16(i int16) Int16 {
	return Int16{NullInt16: sql.NullInt16{Int16: i, Valid: true}}
}

// MarshalJSON implements MarshalJSON.
func (ni *Int16) MarshalJSON() ([]byte, error) {
	if !ni.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ni.Int16)
}

// UnmarshalJSON implements UnmarshalJSON.
func (ni *Int16) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &ni.Int16)
	ni.Valid = (err == nil)
	return err
}
