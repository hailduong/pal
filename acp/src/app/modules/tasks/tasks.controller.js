'use strict';

angular.module('inspinia').controller('TasksCtrl', function ($scope, firebaseHelper, $rootScope, cs, $interval, $uibModal, $state) {
    $scope.loading = true;
    $scope.hasFullfillProfile = false;

    $scope.formatTime = cs.formatTime;
    $scope.formatDate = cs.formatDate;
    $scope.formatDateTime = cs.formatDateTime;
    $scope.newPosts = null;
    $scope.role = "";

    $scope.isPickingTask = false;


    $scope.stat = firebaseHelper.getFireBaseInstance(["posts"]).orderByChild("status").equalTo(PostStatus.Ready).on('value', function(snapshot) {
        $scope.numOfWaitingPost = snapshot.numChildren();
        setTimeout(function() {
            $scope.$digest();
        }, 100);
    });

    $scope.userPoints = 0;
    $scope.userLevel = "";
    $scope.userNextLevelPoints = 0;
    $scope.userLevelPercent = 0;
    var updateUserLevel = function() {
        if (firebaseHelper.hasAlreadyLogin() && $rootScope.config) {
            $scope.userPoints = firebaseHelper.getPublicProfile().points || 0;
            var scale = $rootScope.config.advisor_level_scales;
            for (var k in scale) {
                if (scale[k].min_points <= $scope.userPoints) {
                    $scope.userLevel = scale[k].name;
                } else {
                    $scope.userNextLevelPoints = scale[k].min_points;
                    break;
                }
            }
            if (!$scope.userNextLevelPoints) {
                $scope.userNextLevelPoints = $scope.userPoints + 1;
            }
            $scope.userLevelPercent = Math.round (($scope.userPoints*1.0/$scope.userNextLevelPoints)*100);
        }
        setTimeout(function() {
            $scope.$apply();
        })
    }

    var init = function() {
        var pubProfile = firebaseHelper.getPublicProfile();
        $scope.role = firebaseHelper.getRole();
        $scope.hasFullfillProfile = firebaseHelper.getRole() == 'admin' ||
            (
                pubProfile.first_name && pubProfile.last_name && pubProfile.avatar && pubProfile.exp
            );

        $scope.newPosts = firebaseHelper.syncArray(
            firebaseHelper
                .getFireBaseInstance("posts")
                .orderByChild("status")
                .equalTo(PostStatus.Ready)
                .limitToFirst(5));

        $scope.onLoadMoreDoneTask();

        updateUserLevel();
        $scope.loading = false;
    }
    if (firebaseHelper.hasAlreadyLogin()) {
        init();
    } else {
        $scope.$on("user:login", function() {
            init();
        })
    }


    var getNewTask = function(callback) {
        var uid = firebaseHelper.getUID();
        firebaseHelper.getFireBaseInstance(["posts"]).orderByChild("status").equalTo(PostStatus.Ready).limitToFirst(1).once('value', function(snapshot) {
            var numChildren = snapshot.numChildren();
            if (numChildren > 0) {
                snapshot.forEach(function(childSnapshot) {
                    var key = childSnapshot.key();
                    var childData = childSnapshot.val();
                    if (childData.status === PostStatus.Ready) {
                        var ref = firebaseHelper.getFireBaseInstance(["posts", key]);
                        ref.once('value', function() {
                            ref.transaction(function(current) {
                                if (!current) {
                                    return;
                                } else {
                                    if (current.status === PostStatus.Ready) {
                                        current = new Post(current)
                                            .set("status", PostStatus.AdvisorProcessing)
                                            .set("has_read", false)
                                            .set("advisor_id", uid)
                                            .doModify(uid)
                                            .get();
                                    }
                                }
                                return current;
                            }, function(error, committed, snapshot) {
                                if (snapshot) {
                                    callback(new Post(snapshot));
                                } else {
                                    callback();
                                }
                            });
                        });
                    }
                    return;
                })
            } else {
                callback();
            }
        });
    }

    var resumeLastPick = function(callback) {
        var uid = firebaseHelper.getUID();
        firebaseHelper
            .getFireBaseInstance("posts")
            .orderByChild("index_advisior_status")
            .startAt(PostHelper.buildIndex(uid, PostStatus.AdvisorProcessing))
            .endAt(PostHelper.buildIndex(uid, PostStatus.AdvisorProcessing))
            .limitToFirst(1)
            .once('value', function(snapshot) {
                var numChildren = snapshot.numChildren();
                if (numChildren > 0) {
                    snapshot.forEach(function(childSnapshot) {
                        var key = childSnapshot.key();
                        var childData = childSnapshot.val();
                        if (childData.status === PostStatus.AdvisorProcessing) {
                            var ref = firebaseHelper.getFireBaseInstance(["posts", key]);
                            ref.once('value', function() {
                                ref.transaction(function(current) {
                                    if (!current) {
                                        return;
                                    } else {
                                        if (current.status === PostStatus.AdvisorProcessing) {
                                            current = new Post(current)
                                                .set("status", PostStatus.AdvisorProcessing)
                                                .set("has_read", false)
                                                .set("advisor_id", uid)
                                                .doModify(uid)
                                                .get();
                                        }
                                    }
                                    return current;
                                }, function(error, committed, snapshot) {
                                    if (snapshot) {
                                        callback(new Post(snapshot));
                                    } else {
                                        callback();
                                    }
                                });
                            });
                        }
                        return;
                    })
                } else {
                    callback();
                }
            });
    }

    var openModal = function(post) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'task_modal.html',
            controller: 'TaskModalCtrl',
            size: 'lg',
            resolve: {
                item: function () {
                    return post;
                }
            }
        });
        modalInstance.result.then(function () {
            $scope.isPickingTask = false;
            updateUserLevel();
        }, function () {
            $scope.isPickingTask = false;
            updateUserLevel();
        });
    }

    $scope.onPickTask = function() {
        if ($scope.isPickingTask) {
            return;
        }
        $scope.isPickingTask = true;

        if (firebaseHelper.hasAlreadyLogin()) {
            resumeLastPick(function(post) {
                if (!post) {
                    getNewTask(function(new_post) {
                        if (!new_post) {
                            $scope.isPickingTask = false;
                            $rootScope.notifyError("No more task available. Please try again later");
                        } else {
                            console.log("new post", new_post);
                            openModal(new_post);
                        }
                    })
                } else {
                    console.log("Resume last post", post);
                    openModal(post);
                }
            });
        } else {
            $scope.isPickingTask = false;
            $state.go("login");
        }
    }


    $scope.hasMoreDoneTask = false;
    $scope.totalDoneTaskLoaded = 10;
    $scope.onLoadMoreDoneTask = function() {
        $scope.totalDoneTaskLoaded = $scope.totalDoneTaskLoaded + 1;
        $scope.completedPosts = firebaseHelper.syncArray(
            firebaseHelper
                .getFireBaseInstance("posts")
                .orderByChild("index_advisior_status")
                .startAt(PostHelper.buildIndex(firebaseHelper.getUID(), PostStatus.AdvisorProcessing + 1))
                .endAt(PostHelper.buildIndex(firebaseHelper.getUID(), PostStatus.AdvisorProcessing + 1))
                .limitToFirst($scope.totalDoneTaskLoaded));

        $scope.completedPosts.$loaded().then(function(list) {
            $scope.hasMoreDoneTask = $scope.totalDoneTaskLoaded == list.length;
        })
    }
});


angular.module('inspinia').controller('TaskModalCtrl', function($rootScope, $scope, $timeout, $modalInstance, cs, item, firebaseHelper, $http, parseHelper, notify, AdvisorService) {
    $scope.data = cs.purify(item.get());

    $scope.formatTime = cs.formatTime;
    $scope.formatDate = cs.formatDate;
    $scope.formatDateTime = cs.formatDateTime;
    $scope.teacher_audio = null;
    $scope.audioRecorder = null;
    $scope.vote = 0;
    $scope.pre_vote = 0;
    $scope.comment = "";
    $scope.isSubmitting = false;

    $scope.user = firebaseHelper.getFireBaseInstance(["profiles_pub", $scope.data.created_by, "display_name"]).once('value', function(snapshot) {
        $scope.user_display_name = snapshot.val() || "Unknown";
        setTimeout(function(){
            $scope.$digest();
        }, 100);
    }, function() {});

    $scope.isRecording = false;
    $scope.startRecord = function() {
        if ($scope.teacher_audio && $scope.teacher_audio.playing) {
            $scope.teacher_audio.pause();
        }
        navigator.getUserMedia({audio:true, video:false}, function(stream) {
            $scope.audioRecorder = RecordRTC(stream, {
                sampleRate: 44100,
                bufferSize: 16384,
                numberOfAudioChannels: 1
            });
            $scope.audioRecorder.startRecording();
            $scope.isRecording = true;
            $scope.$apply();
        }, function(error) {
            console.log(error)
        });
    }

    $scope.stopRecord = function(callback) {
        if ($scope.isRecording) {
            $scope.audioRecorder.stopRecording(function (audioVideoWebMURL) {
                $scope.isRecording = false;
                $scope.teacher_audio = new Audio();
                $scope.teacher_audio.src = audioVideoWebMURL;
                $scope.teacher_audio.playing = false;
                $scope.teacher_audio.addEventListener('ended', function(){
                    $scope.teacher_audio.playing = false;
                    $scope.$digest();
                });
                if (callback)  {callback();}
                $scope.$apply();
            });
        } else {
            if (callback)  {callback();}
        }
    }

    $scope.playStopRecord = function() {
        if ($scope.teacher_audio.playing) {
            $scope.teacher_audio.pause()
        } else {
            $scope.teacher_audio.play()
        }
        $scope.teacher_audio.playing = !$scope.teacher_audio.playing;
    }

    $scope.cancel = function () {
        if (firebaseHelper.getUID()) {
            firebaseHelper.getFireBaseInstance(["posts", $scope.data.$id]).update({
                status: PostStatus.Ready,
                index_user_status: PostHelper.buildIndex($scope.data.created_by, PostStatus.Ready),
                index_advisior_status: PostHelper.buildIndex($scope.data.advisor_id, PostStatus.Ready)
            }, function(error) {
                if (error) {
                    $rootScope.notifyError(error);
                } else {
                    $rootScope.notifySuccess("You have rejected a task");
                }
            });
        } else {
            $rootScope.notifyError("Something wrong");
        }

        $scope.isSubmitting = false;
        $modalInstance.dismiss('cancel');
    };

    var submit = function(audio) {
        //posted audio, now save question content
        firebaseHelper.getFireBaseInstance(["posts", $scope.data.$id]).transaction(function(recent){
            if (!recent) {
                $rootScope.notifyError("Something wrong. Please try again");
                return;
            } else {
                var uid = firebaseHelper.getUID();
                if (recent.status == PostStatus.AdvisorProcessing && recent.advisor_id == uid) {
                    recent = new Post(recent)
                        .set("status", PostStatus.AdvisorEvaluated)
                        .set("score", $scope.vote)
                        .set("hasRead", false)
                        .push("conversation", {
                            created_date: Date.now(),
                            uid: uid,
                            audio: audio || "",
                            text: $scope.comment
                        })
                        .doModify(uid)
                        .get();
                    return recent;
                } else {
                    $rootScope.notifyError("This task was tranferred to another advisor before");
                    return;
                }
            }

        }, function(error, committed, snapshot){
            if (error) {
                $rootScope.notifyError("Something wrong. Please try again");
            } else if (!committed) {
                $rootScope.notifyError("Fail to save data");
            } else {
                $modalInstance.close();
                //update user score
                AdvisorService.addEvaluatingPoint(firebaseHelper.getUID(), $scope.data.$id, function(pts) {
                    notify({
                        message:"Congratulation! You've earned " + pts + " point " + (pts>1?"s":"") + " from evaluating user post",
                        classes: 'alert-success'
                    });
                });
                parseHelper.push($scope.data.created_by, "You've got new feedback from advisor");
            }
            $scope.isSubmitting = false;
            $scope.$apply();
        });
    }

    $scope.onDone = function() {
        if ($scope.isSubmitting) {
            return;
        }

        if (firebaseHelper.getUID()) {
            $scope.isSubmitting = true;
            if ($scope.teacher_audio && $scope.teacher_audio.playing) {
                $scope.teacher_audio.pause()
                $scope.teacher_audio.playing = false;
            }

            $scope.stopRecord(function() {
                //post audio file to server
                if ($scope.audioRecorder) {
                    $scope.audioRecorder.getDataURL(function(dataURL) {
                        var fileName = "advisors_" + firebaseHelper.getUID() + "_" + $scope.data.$id + "_" + Date.now();
                        var audioType = $scope.audioRecorder.getBlob().type;
                        var audio = {
                            name: fileName + '.' + audioType.split('/')[1],
                            type: audioType,
                            contents: dataURL
                        }
                        $http.post(window.RTC_SERVER, audio).then(function(data) {
                            console.log(data.data.url);
                            if (!data.data.url) {
                                $rootScope.notifyError("Fail to upload audio. Invalid response");
                                $scope.isSubmitting = false;
                                return;
                            }
                            submit(data.data.url);
                        }, function() {
                            $rootScope.notifyError("Fail to upload audio");
                            $scope.isSubmitting = false;
                        });
                    });
                } else {
                    submit();
                }
            });
        } else {
            $rootScope.notifyError("Something wrong");
        }
    }
});
