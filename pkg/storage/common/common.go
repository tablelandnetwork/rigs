package common

import (
	"database/sql"
	"encoding/json"
)

// NullableString wraps a sql.NullString to provide custom JSON.
type NullableString struct {
	sql.NullString
}

// MarshalJSON implements MarshalJSON.
func (ns *NullableString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.String)
}

// UnmarshalJSON implements UnmarshalJSON.
func (ns *NullableString) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &ns.String)
	ns.Valid = (err == nil)
	return err
}

// NullableInt16 wraps a sql.NullInt16 to provide custom JSON.
type NullableInt16 struct {
	sql.NullInt16
}

// MarshalJSON implements MarshalJSON.
func (ni *NullableInt16) MarshalJSON() ([]byte, error) {
	if !ni.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ni.Int16)
}

// UnmarshalJSON implements UnmarshalJSON.
func (ni *NullableInt16) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &ni.Int16)
	ni.Valid = (err == nil)
	return err
}
