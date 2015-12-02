package vietnamworks.com.pal.fragments;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

import com.squareup.picasso.Picasso;

import java.io.File;
import java.util.Map;

import vietnamworks.com.pal.R;
import vietnamworks.com.pal.activities.BaseActivity;
import vietnamworks.com.pal.activities.TimelineActivity;
import vietnamworks.com.pal.common.PicassoCircleTransform;
import vietnamworks.com.pal.entities.UserProfile;
import vietnamworks.com.pal.models.CurrentUserProfile;
import vietnamworks.com.pal.services.AsyncCallback;
import vietnamworks.com.pal.services.CloudinaryService;
import vietnamworks.com.pal.services.GaService;

/**
 * Created by duynk on 12/1/15.
 */
public class ProfileFragment extends BaseFragment {
    Button uploadAvatar;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout containing a title and body text.
        ViewGroup rootView = (ViewGroup) inflater
                .inflate(R.layout.fragment_profile, container, false);
        BaseActivity.applyFont(rootView);

        ((ImageButton)rootView.findViewById(R.id.btn_profile_back)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                ((TimelineActivity) getActivity()).onBackPressed();
            }
        });

        uploadAvatar = ((Button)rootView.findViewById(R.id.btn_upload_avatar));
        uploadAvatar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                selectImage();
            }
        });

        return rootView;
    }

    @Override
    public void onResume() {
        super.onResume();
        BaseActivity.sInstance.hideActionBar();
        GaService.trackScreen(R.string.ga_screen_profile);
        loadData();
    }

    @Override
    public void onDestroy() {
        BaseActivity.sInstance.showActionBar();
        super.onDestroy();
    }

    private void selectImage() {
        final CharSequence[] items = { getString(R.string.avatar_picker_take_photo), getString(R.string.avatar_picker_library), getString(R.string.cancel) };

        AlertDialog.Builder builder = new AlertDialog.Builder(getActivity());
        builder.setTitle(getString(R.string.avatar_picker_title));
        builder.setItems(items, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int item) {
                if (items[item].equals(getString(R.string.avatar_picker_take_photo))) {
                    Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    File f = new File(android.os.Environment.getExternalStorageDirectory(), getString(R.string.avatar_picker_take_photo_temp_file));
                    intent.putExtra(MediaStore.EXTRA_OUTPUT, Uri.fromFile(f));
                    getActivity().startActivityForResult(intent, TimelineActivity.REQUEST_CAMERA);
                } else if (items[item].equals(getString(R.string.avatar_picker_library))) {
                    Intent intent = new Intent(
                            Intent.ACTION_PICK,
                            android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
                    intent.setType("image/*");
                    getActivity().startActivityForResult(
                            Intent.createChooser(intent, getString(R.string.avatar_picker_select_file)),
                            TimelineActivity.SELECT_FILE);
                } else if (items[item].equals(getString(R.string.cancel))) {
                    dialog.dismiss();
                }
            }
        });
        builder.show();
    }

    public void onSelectedAvatar(Bitmap b) {
        final TimelineActivity activity = (TimelineActivity)getActivity();
        final View view = getView();

        if (activity != null && view != null) {
            uploadAvatar.setEnabled(false);

            CloudinaryService.uploadAvatar(b, new AsyncCallback() {
                @Override
                public void onSuccess(Context ctx, Object res) {
                    Map m = (Map) res;
                    final String url = m.get("secure_url").toString();
                    CurrentUserProfile.updateAvatar(url);
                    BaseActivity.timeout(new Runnable() {
                        @Override
                        public void run() {
                            uploadAvatar.setEnabled(true);
                            Picasso.with(getContext()).load(url).transform(new PicassoCircleTransform()).into(((ImageView) view.findViewById(R.id.avatar)));
                        }
                    });
                }

                @Override
                public void onError(Context ctx, int error_code, String message) {
                    BaseActivity.timeout(new Runnable() {
                        @Override
                        public void run() {
                            uploadAvatar.setEnabled(true);
                        }
                    });
                    BaseActivity.toast(R.string.avatar_picker_upload_fail);
                }
            });
        }
    }

    void loadData() {
        BaseActivity.timeout(new Runnable() {
            @Override
            public void run() {
                UserProfile u = UserProfile.getCurrentUserProfile();
                View v = getView();
                if (v != null) {
                    if (!u.getAvatar().isEmpty()) {
                        Picasso.with(getContext()).load(u.getAvatar()).transform(new PicassoCircleTransform()).into(((ImageView) v.findViewById(R.id.avatar)));
                    }
                    ((TextView) v.findViewById(R.id.firstname)).setText(u.getFirstName());
                    ((TextView) v.findViewById(R.id.lastname)).setText(u.getLastName());
                    ((TextView) v.findViewById(R.id.display_name)).setText(u.getDisplayName());
                    ((TextView) v.findViewById(R.id.email)).setText(u.getEmail());

                    ((TextView) v.findViewById(R.id.posts)).setText(String.format("%d", u.getTotalPosts()));
                    ((TextView) v.findViewById(R.id.avg_pts)).setText(String.format("%.2f", u.getScore()));
                    ((TextView) v.findViewById(R.id.exp_pts)).setText(String.format("%d", u.getExp()));
                    ((TextView) v.findViewById(R.id.level)).setText(u.getLevelName());
                    ((TextView) v.findViewById(R.id.level_percent)).setText(String.format("%d %%", u.getLevelCompletion()));
                }
            }
        }, 100);
    }
}