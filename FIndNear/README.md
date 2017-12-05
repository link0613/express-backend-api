

# FindNear Backend API
FindNear is auto drawing app for powerball and megamillions lotteries.
Here are JSON backend APIs of the FindNear.



## API Resources
Every api resource has prefix of <hostname:port>/api/<version>/
Example: http://findnear.com:3000/api/v1/register

### General API Response
All the responses are based on JSON and have the following payload parameters
* success: boolean value indicating whether the request is succeeded or failed.
* error: error no value with in the system. for example 410 indicates username/password is invalid to authenticate.
* message: error message readable by the end user.
* results: array of results in list apis.

Most APIs needs access token to validate access which returned by login/register API.
If access token is invalid, it's returned 403 as error no in response.
The client side should save this value locally after logging in/signing up and reuse it whenever needed.
When the response indicates that token is invalid, the client side should re-login to the system in order to get new access token reusable.

All the timestamp values are based on timestamp in seconds since 1/1/1970.


### POST /login
Username/Password authentication

#### Parameters
* username: username in FindNear
* password: password to authenticate

#### Response
* success: true/false
* token: token of the current login which's used for further api resources later
* userId: user identifier of the current user logged in

#### Error No
* 410: Invalid username/password


### POST /logout
Log out and remove the current access token from the system

#### Parameters
* access_token: access token returned by login/register API

#### Response
* success: true/false

#### Error No
* 413: Invalid token


### POST /register
User registration

#### Parameters
* username: username in FindNear
* password: password to authenticate
* email: email address
* displayName: display name of the user
* description: description of the user
* firstName: first name of the user
* lastName: last name of the user
* profile: multipart form image data

#### Response
* success: true/false
* token: token of the current login which's used for further api resources later
* userId: user identifier of the current user logged in

#### Error No
* 411: username duplicate
* 412: email duplicate


## Usage



## Version
* Version 1.0


## Developing
It's currently under development and constantly updated.



##Contact

